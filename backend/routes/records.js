const express = require("express");
const router = express.Router();
const { addRecord, getRecord } = require("../blockchain");

router.post("/add", async (req, res) => {
  const { data } = req.body;
  const result = await addRecord(data);
  res.json({ message: result });
});

router.get("/:address", async (req, res) => {
  const record = await getRecord(req.params.address);
  res.json({ record });
});

module.exports = router;
