import express from "express";

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Vercel Node API running 🚀");
});

app.get("/test", (req, res) => {
  res.json({ message: "Laravel calling Node API successfully" });
});

// Export the Express app as a serverless function
export default app;