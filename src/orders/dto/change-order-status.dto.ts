import { IsEnum, IsUUID } from "class-validator";
import { OrderStatus } from "generated/prisma/enums";
import { OrderStatusList } from "../enum/order.enum";

export class ChangeOrderStatusDto {
    @IsUUID()
    id: string;

    @IsEnum(OrderStatusList, {
        message: `Invalid status, possible values are ${OrderStatusList}`
    })
    status: OrderStatus;
}
