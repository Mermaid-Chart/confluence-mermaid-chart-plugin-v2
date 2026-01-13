import axios from 'https://esm.sh/axios';
import { MC_BASE_URL } from '../../../routes';

const getBaseURL = () => {
  return window.MC_BASE_URL || "https://test.mermaidchart.com";
};

const httpClient = axios.create({
  baseURL: getBaseURL(),
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
