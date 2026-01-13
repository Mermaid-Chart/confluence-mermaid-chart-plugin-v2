import axios from 'https://esm.sh/axios';


const httpClient = axios.create({
  baseURL: process.env.MC_BASE_URL || "https://test.mermaidchart.com",
  headers: {
    'Content-Type': 'application/json',
  },
});

httpClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('HTTP Client error:', error);
    return Promise.reject(error);
  }
);

export default httpClient;
