const httpAdapter = require('axios/lib/adapters/http');
const settle = require('axios/lib/core/settle');

const createCache = ({ db, collectionName, expireAfterSeconds }) => {
  const axiosCache = db.collection(collectionName);
  axiosCache.createIndex({ "cachedAt": 1 }, { expireAfterSeconds: expireAfterSeconds });

  const getFromCache = async (config) => {
    const cachedRequest = await axiosCache.findOne({
      method: config.method,
      url: config.url,
      data: config.data,
      params: config.params
    });

    return cachedRequest;
  }

  const addCachedResponse = async (config, response) => {
    const axiosCache = db.collection(collectionName);

    await axiosCache.insertOne({
      method: config.method,
      url: config.url,
      data: config.data,
      params: config.params,
      response: {
        status: response.status,
        data: response.data,
        headers: response.headers,
        config: response.config,
        request: {
          responseURL: config.url
        }
      },
      cachedAt: new Date()
    });
  }

  async function httpCallWithoutCache(config, cacheCallback) {
    const response = await httpAdapter(config);
    cacheCallback && await cacheCallback(config, response);

    return response;
  }

  return (config) => new Promise(async (resolve, reject) => {
    let response = null;

    const method = config.method.toLowerCase();
    switch (method) {
    case 'get':
      const cached = await getFromCache(config);
      if (cached) {
        response = cached.response;
      } else {
        response = await httpCallWithoutCache(config, addCachedResponse)
      }
      break;
    default:
      response = await httpCallWithoutCache(config, null);
      break;
    }

    await settle(resolve, reject, response);
  });
}

module.exports = createCache;
