const axios = require('axios');

async function generateSolution(prompt, model = 'llama3.2') {
  try {
    const response = await axios.post('http://localhost:11434/api/generate', {
      model: model,
      prompt: prompt,
      stream: false
    });
    return response.data.response;
  } catch (error) {
    console.error('Error calling Ollama:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('Make sure Ollama is running! (run "ollama serve" in a terminal)');
    }
    return null;
  }
}

module.exports = { generateSolution };
