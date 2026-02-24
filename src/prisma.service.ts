import { Injectable, InternalServerErrorException, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg'; // PostgreSQL
import { PrismaClient } from 'generated/prisma/client';
import { envs } from './config';
import { RpcException } from '@nestjs/microservices';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('PrismaService');

  constructor() {
    const adapter = new PrismaPg({
      connectionString: envs.POSTGRES_URL
    });

    super({ adapter });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      await this.$queryRaw`SELECT 1`;
      this.logger.log('Prisma connected to the database successfully');
    } catch (error) {
      this.logger.error(`Prisma connection error: ${error}`);
      throw new RpcException(error);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}