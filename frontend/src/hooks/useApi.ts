import axios from 'axios';
import { useMemo } from 'react';
import toast from 'react-hot-toast';

export function useApi() {
  const api = useMemo(() => {
    const instance = axios.create({
      baseURL: process.env.REACT_APP_API_URL ?? 'http://localhost:3001',
    });

    instance.interceptors.response.use(
      (res) => res,
      (err) => {
        if (err.response?.status === 403) {
          toast.error('You do not have permission to perform this action.');
        }
        return Promise.reject(err);
      }
    );

    return instance;
  }, []);

  return api;
}
