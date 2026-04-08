import { api } from './client';

export interface Product {
  id: string;
  title: string;
  description: string;
  handle: string;
  image: string | null;
  imageAlt: string | null;
  price: string;
  currency: string;
}

export const marketApi = {
  getProducts: (first = 12) =>
    api.get<Product[]>('/market/products', { params: { first } }),
};
