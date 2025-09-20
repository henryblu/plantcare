// test.js
fetch("http://localhost:5173/api/openai/policy", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "gpt-4o-mini",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "You are Smart Plant's horticulture specialist." },
      {
        role: "user",
        content:
          "Species canonical name: Dracaena trifasciata; Species key: dracaena_trifasciata; Suggested species type: tropical (best guess); Generate the policy JSON now.",
      },
    ],
    max_tokens: 400,
  }),
}).then(r => console.log("proxy status", r.status, r.statusText))
  .catch(console.error);
