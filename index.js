const httpAdapter = require('axios/lib/adapters/http');
const settle = require('axios/lib/core/settle');
const { createHash } = require('crypto');
const { at } = require('lodash');

const createCache = ({ db, collectionName, expireAfterSeconds, match = [] }) => {
  const axiosCache = db.collection(collectionName);
  axiosCache.createIndex({ "cachedAt": 1 }, { expireAfterSeconds: expireAfterSeconds });

  const digest = (config) => {
    const properties = ['url', 'data', 'params'].concat(match);
    const hash = createHash('SHA256');
    properties.forEach((key) => {
      const value = at(config, key).filter((a) => a);
      if (!value || value.length === 0) {
        return '';
      }

      let toDigest = '';
      switch (typeof value) {
        case 'object':
          const valueKeys =  Object.keys(value).sort();
          toDigest = valueKeys.map((valueKey) => {
            return value[valueKey];
          }).join('');
          break;
        case 'array':
          const sorted = value.sort();
          toDigest = sorted.reduce((previousValue, currentValue) => {
            return `${previousValue}:${currentValue}`;
          });
          break;
        default:
          toDigest = value;
          break;
      }

      hash.update(toDigest);
    });

    return hash.digest('hex');
  }

  const getFromCache = async (config) => {
    const hash = digest(config);
    return await axiosCache.findOne({ 
      url: config.url,
      method: config.method,
      sha256: hash
    });
  }

  const addCachedResponse = async (config, response) => {
    const axiosCache = db.collection(collectionName);
    const hash = digest(config);

    await axiosCache.insertOne({
      url: config.url,
      method: config.method,
      sha256: hash,
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
