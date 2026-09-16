const appJson = require('./app.json');

module.exports = ({ config }) => {
  const base = { ...(appJson.expo || appJson), ...config };
  return {
    ...base,
  };
};


