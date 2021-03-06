import AWS from 'aws-sdk';
import AWSESConnection from 'http-aws-es';
import Elasticsearch from 'elasticsearch';
import bodyBuilder from 'bodybuilder';
import App from '../../App';

let _esClient = null;

function awsCredentials() {
  return new AWS.EnvironmentCredentials('AWS');
}

function getDocument(indexName, indexType, id, esClient = null) {
  const client = _esClient || esClient || createClient({});
  App.logger().debug('ElasticSearch.get', id);
  return client.get({
    index: indexName,
    type: indexType,
    id
  });
}

function deleteDocument(indexName, indexType, id, esClient = null) {
  const client = _esClient || esClient || createClient({});
  return client.delete({
    index: indexName,
    type: indexType,
    id
  });
}

function createOrUpdateDocument(indexName, indexType, id, item, esClient = null) {
  const client = _esClient || esClient || createClient({});

  return client.index({
    index: indexName,
    type: indexType,
    id,
    body: item
  });
}

function search(indexName, indexType, queryBody, esClient = null) {
  const client = _esClient || esClient || createClient({});
  const esQueryRequest = {
    index: indexName,
    type: indexType,
    body: queryBody
  };
  App.logger().debug('ElasticSearch.search', JSON.stringify(esQueryRequest));
  return client.search(esQueryRequest);
}

// {
//   "bool" : {
//      "must" :     [], // ANDs (Query scope)
//      "should" :   [], // ORs (Query scope)
//      "must_not" : [], // NOTs (Query scope)
//      "filter":    []  // (Filter scope) Filters: currently supports AND operations between all filters
//   }
// }

// Note that to perform term queries we need to access the .keyword field instead of the raw one
// For more details visit https://www.elastic.co/guide/en/elasticsearch/reference/5.3/multi-fields.html
function buildQueryFilters(conditions) {
  return conditions
    .filter(conditionObject => conditionObject.conditionType === 'filter') // we only support must queries for now
    .reduce((aggregatedBody, nextCondition) => {
      const fieldToQuery = nextCondition.condition.queryType.match(/term/) ? `${nextCondition.condition.fieldToQuery}.keyword` : nextCondition.condition.fieldToQuery;
      return aggregatedBody.filter(nextCondition.condition.queryType, fieldToQuery, nextCondition.condition.searchTerm);
    }, bodyBuilder());
}

function createClient({ credentials = awsCredentials(), elasticSearchHost = process.env.ES_HOST, elasticSearchRegion = process.env.ES_REGION }) {
  if (!_esClient) {
    const options = {
      hosts: [elasticSearchHost],
      connectionClass: AWSESConnection,
      awsConfig: new AWS.Config({ region: elasticSearchRegion })
    };
    _esClient = new Elasticsearch.Client(options);
  }
  return _esClient;
}

export default {
  createOrUpdateDocument,
  getDocument,
  deleteDocument,
  search,
  buildQueryFilters
};
