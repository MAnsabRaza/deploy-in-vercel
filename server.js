const app = require("./api/index.js");
const PORT = 3000;

app.listen(PORT, () => {
  console.log(`🚀 Local server running at http://localhost:${PORT}`);
});