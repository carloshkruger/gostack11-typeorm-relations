import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const findCustomer = await this.customersRepository.findById(customer_id);

    if (!findCustomer) {
      throw new AppError('Customer does not exists.');
    }

    const findProducts = await this.productsRepository.findAllById(products);

    if (findProducts.length !== products.length) {
      throw new AppError('Some informed product does not exist.');
    }

    findProducts.forEach(findProduct => {
      const productQuantity =
        products.find(product => product.id === findProduct.id)?.quantity || 0;

      if (findProduct.quantity < productQuantity) {
        throw new AppError(`${findProduct.name} has insufficient stock.`);
      }
    });

    const productsToInsert = products.map(product => {
      return {
        product_id: product.id,
        quantity: product.quantity,
        price:
          findProducts.find(findProduct => findProduct.id === product.id)
            ?.price || 0,
      };
    });

    const order = await this.ordersRepository.create({
      customer: findCustomer,
      products: productsToInsert,
    });

    const productsToUpdate = findProducts.map(findProduct => {
      return {
        id: findProduct.id,
        quantity:
          findProduct.quantity -
          (productsToInsert.find(
            productToInsert => productToInsert.product_id === findProduct.id,
          )?.quantity || 0),
      };
    });

    await this.productsRepository.updateQuantity(productsToUpdate);

    return order;
  }
}

export default CreateOrderService;
