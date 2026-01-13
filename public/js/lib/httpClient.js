import axios from 'https://esm.sh/axios';
import { MC_BASE_URL } from '../../../routes';


const httpClient = axios.create({
  baseURL: MC_BASE_URL  ,
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
