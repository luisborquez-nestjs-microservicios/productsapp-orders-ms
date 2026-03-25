import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { NATS_SERVICE } from 'src/config';
import { PrismaService } from 'src/prisma.service';
import { ChangeOrderStatusDto, CreateOrderDto, OrderPaginationDto, PaidOrderDto } from './dto';
import { OrderWithProducts } from './interfaces/order-with-products.interface';
import { OrderStatus } from 'generated/prisma/enums';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    @Inject(NATS_SERVICE) private client: ClientProxy,
  ) { }

  async create(createOrderDto: CreateOrderDto) {
    // return await this.prisma.order.create({ data: createOrderDto });
    try {
      const ids = createOrderDto.items.map(item => item.productId);
      const products = await firstValueFrom(
        this.client.send({ cmd: 'validate_products' }, ids)
      );

      let totalAmount = 0;
      let totalItems = 0;
      createOrderDto.items.forEach(orderItem => {
        const productInfo = products.find(product => product.id === orderItem.productId);
        totalAmount += orderItem.quantity * productInfo.price;
        totalItems += orderItem.quantity;
      });

      const order = await this.prisma.order.create({
        data: {
          totalAmount: totalAmount,
          totalItems: totalItems,
          OrderItem: {
            createMany: {
              data: createOrderDto.items.map(orderItem => ({
                productId: orderItem.productId,
                quantity: orderItem.quantity,
                price: products.find(product => product.id === orderItem.productId).price
              }))
            }
          }
        },
        include: {
          OrderItem: {
            select: {
              price: true,
              quantity: true,
              productId: true
            }
          }
        }
      });

      return {
        ...order,
        OrderItem: order.OrderItem.map(orderItem => ({
          ...orderItem,
          name: products.find(product => product.id === orderItem.productId).name
        }))
      };
    } catch (error) {
      console.log(`Error while creating an order: ${error}`);

      throw new RpcException({
        status: 'error',
        message: `Error while creating an order, try again`,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    }
  }

  async findAll(orderPaginationDto: OrderPaginationDto) {
    const { page, limit, status } = orderPaginationDto;

    const totalOrders = await this.prisma.order.count({ where: { status: status } });
    const orders = await this.prisma.order.findMany({
      skip: (page! - 1) * limit!,
      take: limit,
      where: { status: status }
    });
    const lastPage = Math.ceil(totalOrders / limit!);

    return {
      meta: {
        page: page,
        limit: limit,
        total: totalOrders,
        lastPage: lastPage,
        next: ((totalOrders / limit!) > page!)
          ? `/api/orders${status ? '/' + status : ''}?page=${(page! + 1)}&limit=${limit}`
          : null,
        prev: (page! > 1)
          ? `/api/orders${status ? '/' + status : ''}?page=${(page! - 1)}&limit=${limit}`
          : null,
      },
      data: orders,
    }
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findFirst({ 
      where: { id },
      include: {
        OrderItem: {
          select: {
            price: true,
            quantity: true,
            productId: true,
          }
        }
      }
    });

    if (!order) {
      throw new RpcException({
        status: 'error',
        message: `Order not found with id ${id}`,
        statusCode: HttpStatus.NOT_FOUND,
      });
    }

    const productsIds = order.OrderItem.map(orderItem => orderItem.productId);
    const products = await firstValueFrom(
      this.client.send({ cmd: 'validate_products' }, productsIds)
    );

    return {
      ...order,
      OrderItem: order.OrderItem.map(orderItem => ({
        ...orderItem,
        name: products.find(product => product.id === orderItem.productId).name
      }))
    };
  }

  async changeStatus(changeOrderStatusDto: ChangeOrderStatusDto) {
    const { id, status } = changeOrderStatusDto;

    const order = await this.findOne(id);
    if (order.status === status) return order;

    const updatedOrder = await this.prisma.order.update({
      where: { id },
      data: { status }
    });

    return updatedOrder;
  }

  async createPaymentSession(order: OrderWithProducts) {
    try {
      const paymentSession = await firstValueFrom(
        this.client.send('create.payment.session', {
          orderId: order.id,
          currency: 'usd',
          items: order.OrderItem.map(item => ({
            name: item.name,
            price: item.price,
            quantity: item.quantity
          })),
        })
      );

      return paymentSession;
    } catch (error) {
      console.log(`Error while creating payment session: ${(error instanceof Object) ? JSON.stringify(error) : error}`);

      throw new RpcException({
        status: 'error',
        message: `Error while creating payment session, try again`,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    }
  }

  async paidOrder(paidOrderDto: PaidOrderDto) {    
    const order = await this.findOne(paidOrderDto.orderId);
    if (order.status === OrderStatus.PAID) return order;

    const updatedOrder = await this.prisma.order.update({
      where: { id: paidOrderDto.orderId },
      data: {
        status: OrderStatus.PAID,
        paid: true,
        paidAt: new Date(),
        stripeChargeId: paidOrderDto.stripePaymentId,

        // relación con OrderReceipt
        orderReceipt: {
          create: {
            receiptUrl: paidOrderDto.receiptUrl
          }
        }
      }
    });

    return updatedOrder;
  }
}
