import React from 'react';
import { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import SuggestionMachine from 'suggestion-machine';

import parseIntoTokens from '../../utils/parseIntoTokens';
import bookService from '../../services/gutenbergBook';
import suggestionService from '../../services/suggestion';
import storage from '../../services/localStorage';
import calculateSuggestion from '../../services/calculateSuggestion';

import useSources from '../../hooks/useSources';
import useComposition from '../../hooks/useComposition';
import useSuggestion from '../../hooks/useSuggestion';
import useNotification from '../../hooks/useNotification';
import useOptions from '../../hooks/useOptions';

import Notification from '../../components/Notification';
import Navbar from '../../components/Navbar';
import SourcePicker from './sourceSelection/SourcePicker';
import CompositionContainer from './composition/CompositionContainer';
import MenuContainer from './menu/MenuContainer';

import theme from '../../config/colorPalette';
import { CssBaseline } from '@mui/material';

const Home = () => {
  const [userLoggedIn, setUserLoggedIn] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  const proposalInputRef = useRef(null);

  const notification = useNotification('Loading Ghosts...');
  const options = useOptions();
  const composition = useComposition();
  const sources = useSources();
  const suggestion = useSuggestion();

  const initFromLocalStorage = () => {
    if (!storage.isSet('userHasVisited')) {
      setShowWelcome(true);
    }
    if (storage.isSet('composition')) {
      const initialComposition = JSON.parse(storage.get('composition'));
      composition.setContent(initialComposition.content);
      composition.setProposal(initialComposition.proposal);
    }
  };

  useEffect(initFromLocalStorage, []);

  const updateCompositionLocalStorage = () => {
    const serializedComposition = JSON.stringify({
      content: composition.content,
      proposal: composition.proposal,
    });
    storage.set('composition', serializedComposition);
  };

  useEffect(updateCompositionLocalStorage, [
    composition.content,
    composition.proposal,
  ]);

  const updateSuggestion = () => {
    if (sources.current.id) {
      const suggestionParams = {
        tokens: composition.getAllTokens(),
        accuracy: options.suggestionAccuracy,
        amount: options.suggestionCount,
        weighted: options.weightedSuggestions,
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
    options.weightedSuggestions,
  ]);

  useEffect(() => {
    if (!sources.isLoading) {
      notification.update('Ghosts loaded, ready to write!');
    }
  }, [sources.isLoading]);

  const focusProposalInput = () => {
    proposalInputRef.current.focus();
  };

  useEffect(focusProposalInput, [showWelcome, showSearch]);

  const getWordClickSuggestionParams = (wordIndex) => {
    const suggestionParams = {
      tokens: composition.getTokensPreceding(wordIndex),
      accuracy: options.suggestionAccuracy,
      amount: 1,
      weighted: options.weightedSuggestions,
      exclude: composition.content[wordIndex].word,
    };
    return suggestionParams;
  };

  const handleContentClick = (wordIndex) => {
    console.groupCollapsed('Word clicked at index ', wordIndex);
    if (sources.current.isLocal) {
      const machine = sources.getSuggestionMachine(sources.current.id);
      const suggestion = calculateSuggestion(
        machine,
        getWordClickSuggestionParams(wordIndex)
      );
      console.log('Local suggestion found: ', suggestion);
      console.groupEnd();
      composition.updateContentAtIndex(wordIndex, suggestion);
    } else if (!suggestion.isTimedOut()) {
      suggestionService
        .retrieveSuggestionFromServer(
          sources.current,
          getWordClickSuggestionParams(wordIndex)
        )
        .then((suggestion) => {
          console.log('Server suggestion found: ', suggestion);
          console.groupEnd();
          composition.updateContentAtIndex(wordIndex, suggestion);
        });
      suggestion.timeOutUpdates();
    }
  };

  const handleProposalSubmit = () => {
    if (!suggestion.isTimedOut()) {
      composition.addProposalAndSuggestion(suggestion.value);
    }
  };

  const handleDeleteComposition = () => {
    if (
      composition.proposal.length + composition.content.length &&
      confirm('Are you sure you want to delete your composition?')
    ) {
      composition.clearAll();
      notification.update('Composition deleted');
    }
  };

  const handleSourceSelection = (event) => {
    const selectedID = event.target.value;
    const selectedSource = sources.all.find((s) => s.id === selectedID);
    console.log('Source selected: ', selectedSource.title);
    sources.setCurrent(selectedSource);
  };

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

  const handleSearchResultClick = (result) => {
    console.log('Search result selected: ', result);
    createSourceAndMachine(result);
    setShowSearch(false);
  };

  const handleDeleteLocalSource = (sourceID) => {
    notification.update(`Deleted downloaded ghost`);
    sources.removeLocalSourceAndMachine(sourceID);
  };

  const handleLogin = () => {
    setUserLoggedIn(!userLoggedIn);
  };

  return (
    <>
      <CssBaseline />
      <Navbar
        onLoginClick={handleLogin}
        userLoggedIn={userLoggedIn}
        onAboutClick={() => setShowWelcome(true)}
      />
        <div className="home-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Notification text={notification.text} />
          <SourcePicker
            value={sources.current.id}
            onChange={handleSourceSelection}
            allSources={sources.all}
          />
          <CompositionContainer
            composition={composition}
            suggestion={suggestion.value}
            isSuggestionLoading={suggestion.isTimedOut()}
            options={options}
            onProposalSubmit={handleProposalSubmit}
            onContainerClick={() => focusProposalInput()}
            onContentClick={handleContentClick}
            onAddNewLine={() => composition.addNewLine()}
            onDeleteComposition={handleDeleteComposition}
            inputRef={proposalInputRef}
          />
          <MenuContainer
            options={options}
            showOptions={showOptions}
            onOptionsClick={() => setShowOptions(!showOptions)}
            onOpenSearchClick={() => setShowSearch(true)}
          />
        </div>


      {/* <div style={{ display: showWelcome ? 'block' : 'none' }}>
            <Welcome onCloseClick={handleWelcomeClose} />
          </div> */}

      {/* <SearchModal
              open={showSearch}
              onClose={handleSearchClose}
              onSearchResultClick={handleSearchResultClick}
              localSources={sources.all.filter((s) => s.isLocal)}
              onClickDelete={handleDeleteLocalSource}
            /> */}
    </>
  );
};

export default Home;