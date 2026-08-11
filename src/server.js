const app = require('./app');

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Global Server listening on port ${PORT}`);
  console.log(`🔗 Local URL: http://localhost:${PORT}`);
});
