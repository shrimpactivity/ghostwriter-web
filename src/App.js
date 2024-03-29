import React from 'react';
import { useState, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import SuggestionMachine from 'suggestion-machine';

import HomePage from './pages/home/Home';
import AboutPage from './pages/about/About';
import SearchPage from './pages/search/Search';
import ErrorPage from './pages/error/Error';
import SignupPage from './pages/login/Signup';
import TutorialPage from './pages/tutorial/Tutorial';

import bookService from './services/gutenbergBook';
import suggestionService from './services/suggestion';
import storage from './services/localStorage';
import calculateSuggestion from './services/calculateSuggestion';

import useSources from './hooks/useSources';
import useComposition from './hooks/useComposition';
import useSuggestion from './hooks/useSuggestion';
import useNotification from './hooks/useNotification';
import useOptions from './hooks/useOptions';

import { endsInTerminalPunctuation, removeExtraWhitespace } from './utils/text';
import { capitalize } from '@mui/material';


const App = () => {
  const [userLoggedIn, setUserLoggedIn] = useState(false);

  const proposalInputRef = useRef(null);

  const notification = useNotification('Loading Ghosts...');
  const options = useOptions();
  const [showOptions, setShowOptions] = useState(false);
  const composition = useComposition();
  const sources = useSources();
  const suggestion = useSuggestion();

  const nav = useNavigate();

  /**
   * Effect that runs when initial sources are loaded.
   */
  useEffect(() => {
    if (!sources.isLoading) {
      notification.update('Ghosts loaded, ready to write!');


    }
  }, [sources.isLoading]);

  /**
   * Effect for showing first time users the tutorial notification?.
   */
  const navigateFirstTimeUsers = () => {
    if (!storage.isSet('visited')) {
      nav('/about');
    }
  };

  useEffect(navigateFirstTimeUsers, []);

  /**
   * Effect for focusing the text input box when component mounts.
   */
  const focusProposalInput = () => {
    if (proposalInputRef.current) {
      proposalInputRef.current.focus();
    }
  };

  useEffect(focusProposalInput, []);

  /**
   * Returns true if the current suggestion needs to be capitalized based on proposal input 
   * and previous content.
   * @returns {boolean}
   */
  const isSuggestionCapitalized = () => {
    const contentWords = composition.content
      .map((item) => item.word)
      .reduce((accum, current) => accum + ' ' + current, '');
    const predecessorToSuggestion = removeExtraWhitespace(contentWords + composition.proposal);
    if (predecessorToSuggestion === '' || endsInTerminalPunctuation(predecessorToSuggestion)) {
      return true;
    }
    return false;
  };

  /**
   * Effect for updating the suggestion using the currently selected source.
   */
  const updateSuggestion = () => {
    if (sources.current.id) {
      const suggestionParams = {
        tokens: composition.getAllTokens(),
        accuracy: options.suggestionAccuracy,
        amount: options.suggestionCount,
        weighted: options.weightedSuggestions,
        capitalize: isSuggestionCapitalized(),
      };

      if (sources.current.isLocal) {
        const machine = sources.getSuggestionMachine(sources.current.id);
        suggestion.updateFromLocalMachine(machine, suggestionParams);
      } else {
        suggestion.queueUpdateFromServer(sources.current, suggestionParams);
      }
    }
  };

  useEffect(updateSuggestion, [
    composition.content,
    composition.proposal,
    sources.current,
    options.suggestionAccuracy,
    options.suggestionCount,
  ]);

  /**
   * Returns a parameters object usable with the suggestion service for providing
   * an alternate suggestion of the word at the specified index.
   * @param {number} wordIndex Index of the word in the composition content array.
   * @returns {object}
   */
  const getWordClickSuggestionParams = (wordIndex) => {
    const suggestionParams = {
      tokens: composition.getTokensPreceding(wordIndex),
      accuracy: options.suggestionAccuracy,
      amount: 1,
      weighted: options.weightedSuggestions,
      exclude: composition.content[wordIndex].word,
      capitalize:
        wordIndex === 0 ||
        endsInTerminalPunctuation(composition.content[wordIndex - 1].word),
    };
    return suggestionParams;
  };

  /**
   * Handles replacing the specified word with a new suggestion when clicked.
   * @param {number} wordIndex Index of the word in the composition content array.
   */
  const handleContentClick = (wordIndex) => {
    console.groupCollapsed('Word clicked at index ', wordIndex);
    const suggestionParams = getWordClickSuggestionParams(wordIndex);
    if (sources.current.isLocal) {
      const machine = sources.getSuggestionMachine(sources.current.id);
      let suggestion = calculateSuggestion(machine, suggestionParams);
      console.log('Local suggestion found: ', suggestion);
      console.groupEnd();
      if (suggestionParams.capitalize) {
        suggestion = capitalize(suggestion);
      }
      composition.updateContentAtIndex(wordIndex, suggestion);
    } else if (!suggestion.isTimedOut()) {
      suggestionService
        .retrieveSuggestionFromServer(sources.current, suggestionParams)
        .then((suggestion) => {
          console.log('Server suggestion found: ', suggestion);
          console.groupEnd();
          if (suggestionParams.capitalize) {
            suggestion = capitalize(suggestion);
          }
          composition.updateContentAtIndex(wordIndex, suggestion);
        });
      suggestion.timeOutUpdates();
    }
  };

  /**
   * Handles the user 'submitting' their proposal to the composition and accepting the suggestion.
   */
  const handleProposalSubmit = () => {
    if (!suggestion.isTimedOut()) {
      composition.addProposalAndSuggestion(suggestion.value);
    }
  };

  /**
   * Handles the user pressing the delete button and clearing the composition.
   */
  const handleDeleteComposition = () => {
    if (
      composition.proposal.length + composition.content.length &&
      confirm('Are you sure you want to delete your composition?')
    ) {
      composition.clearAll();
      notification.update('Composition deleted');
    }
  };

  /**
   * Handles the user selecting a new source from  the dropdown menu.
   * @param {object} event The onChange event of the select element.
   */
  const handleSourceSelection = (event) => {
    const selectedID = event.target.value;
    const selectedSource = sources.all.find((s) => s.id === selectedID);
    console.log('Source selected: ', selectedSource.title);
    sources.setCurrent(selectedSource);
    focusProposalInput();
  };

  /**
   * Creates a new source and suggestion machine from the specified result of searching the
   * gutenberg catalog using the catalog service. This will download the specified text
   * from project gutenberg and process it for use locally.
   * @param {object} result The catalog result with fields id, title, and authors.
   * @returns {Promise}
   */
  const createSourceAndMachine = (result) => {
    const newSource = {
      id: uuidv4(),
      gutenbergID: result.id,
      title: result.title,
      author: result.authors,
    };

    notification.update(
      `Extracting ${newSource.title} from Project Gutenberg...`,
      Infinity
    );

    return bookService
      .getFormattedBook(newSource.gutenbergID)
      .then((formattedBook) => {
        notification.update(`Sublimating Ghost in alphabetic vat...`, Infinity);
        const tokens = formattedBook.split(' ');
        const newMachine = new SuggestionMachine(tokens);
        sources.addLocalSourceAndMachine(newSource, newMachine);
        notification.update('New Ghost materialized!');
      });
  };

  /**
   * Handles the user clicking an item from the catalog results.
   * @param {object} result
   */
  const handleSearchResultClick = (result) => {
    console.log('Search result selected: ', result);
    createSourceAndMachine(result);
  };

  /**
   * Handles the user deleting a local source from their downloaded sources.
   * @param {string} sourceID The id of the source to delete.
   */
  const handleDeleteLocalSource = (sourceID) => {
    notification.update(
      `Deleted ghost: ${
        sources.all.find((source) => source.id === sourceID).author
      }`
    );
    sources.removeLocalSourceAndMachine(sourceID);
  };

  const handleLogin = () => {
    setUserLoggedIn(!userLoggedIn);
  };

  const handleSearchClose = () => {
    nav('/');
    focusProposalInput();
  };

  const handleWelcomeClose = () => {
    nav('/');
    focusProposalInput();
    storage.set('visited', true);
  };

  const navBarProps = {
    onLoginClick: handleLogin,
    userLoggedIn: userLoggedIn,
    onAboutClick: () => nav('/about'),
    onLogoClick: () => nav('/')
  };

  return (
    <Routes>
      <Route
        path="/about"
        element={
          <AboutPage {...navBarProps} onCloseClick={handleWelcomeClose} />
        }
      />
      <Route
        path="/"
        element={
          <HomePage
            {...navBarProps}
            notification={notification}
            sources={sources}
            onSourceSelectionChange={handleSourceSelection}
            composition={composition}
            suggestion={suggestion}
            options={options}
            onProposalSubmit={handleProposalSubmit}
            onCompositionContainerClick={() => focusProposalInput()}
            onContentWordClick={handleContentClick}
            onDeleteComposition={handleDeleteComposition}
            proposalInputRef={proposalInputRef}
            showOptions={showOptions}
            onOptionsClick={() => setShowOptions(!showOptions)}
            onOpenSearchClick={() => nav('/search')}
          />
        }
      />
      <Route
        path="/search"
        element={
          <SearchPage
            {...navBarProps}
            notification={notification}
            onClose={handleSearchClose}
            onSearchResultClick={handleSearchResultClick}
            localSources={sources.all.filter((source) => source.isLocal)}
            onClickDelete={handleDeleteLocalSource}
          />
        }
      />
      <Route path='/tutorial' element={<TutorialPage {...navBarProps}/>} />
      <Route path='/signup' element={<SignupPage />} />
      <Route path="*" element={<ErrorPage />} />
    </Routes>
  );
};

export default App;
