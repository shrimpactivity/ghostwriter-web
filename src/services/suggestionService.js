import axios from 'axios';
const baseURL = '/api/suggest';

const getSuggestionFromMachine = (tokens, accuracy, amount, suggestionMachine) => {
  const relevantTokens = tokens.slice(-1 * accuracy);
  console.log(
    'Retrieving suggestion using local source with tokens: ',
    relevantTokens
  );
  if (amount > 1) {
    let result;
    suggestionMachine
      .suggestSequenceFor(relevantTokens, amount, accuracy)
      .forEach((suggestion) => {
        result += suggestion + ' ';
      });
    console.log('Suggestion found: ', result.trim());
    return result.trim();
  }
  return suggestionMachine.suggestFor(relevantTokens);
};

const formatTokensIntoQuery = (tokens) => {
  let query = 'q=';
  if (tokens.length) {
    for (let token of tokens) {
      query += `${token}+`;
    }
    query = query.slice(0, query.length - 1);
  }
  return query;
};

const getRequestURL = (tokens, accuracy, amount, source) => {
  return `${baseURL}/${
    source.id
  }/?n=${amount}&a=${accuracy}&${formatTokensIntoQuery(tokens)}`;
}

const retrieveSuggestionFromServer = (tokens, accuracy, amount, source) => {
  const relevantTokens = tokens.slice(-1 * accuracy);

  let url = getRequestURL(relevantTokens, accuracy, amount, source);
  const request = axios.get(url);
  return request
    .then((response) => response.data)
    .catch((error) => {
      console.log(
        `Error retrieving suggestion for tokens ${relevantTokens} from source ${source.title}: ${error}`
      );
      return null;
    });
};

export default { getSuggestionFromMachine, retrieveSuggestionFromServer };
