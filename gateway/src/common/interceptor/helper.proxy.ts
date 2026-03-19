import axios from 'axios';

export const proxyRequest = async (
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  url: string,
  data: any,
  headers: any,
) => {
  const response = await axios({
    method,
    url,
    data,
    headers,
  });

  return response.data;
};
