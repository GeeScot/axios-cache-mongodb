const httpAdapter = require('axios/lib/adapters/http');
const settle = require('axios/lib/core/settle');

const createCache = ({ db, collectionName, expireAfterSeconds }) => {

  const checkCache = async (config) => {
    const axiosCache = db.collection(collectionName);
    axiosCache.createIndex({ "cachedAt": 1 }, { expireAfterSeconds: expireAfterSeconds });

    const cachedRequest = await axiosCache.findOne({
      method: config.method,
      url: config.url,
      data: config.data,
      params: config.params
    });

    return cachedRequest;
  }

  const cacheResponse = async (config, response) => {
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

  return (config) => {
    return new Promise(async (resolve, reject) => {
      const axiosCache = db.collection(collectionName);
      axiosCache.createIndex({ "cachedAt": 1 }, { expireAfterSeconds: expireAfterSeconds });
  
      const cachedRequest = await checkCache(config);
  
      if (cachedRequest) {
        await settle(resolve, reject, cachedRequest.response);
        return;
      }
  
      const response = await httpAdapter(config);
      await cacheResponse(config, response);
  
      await settle(resolve, reject, response);
    })
  }
}

module.exports = createCache;
