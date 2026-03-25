import { OrderStatus } from "generated/prisma/enums";

export const OrderStatusList = [
    OrderStatus.PENDING,
    OrderStatus.PAID,
    OrderStatus.DELIVERED,
    OrderStatus.CANCELLED,
];
