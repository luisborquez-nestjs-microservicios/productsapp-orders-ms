import { Catch, RpcExceptionFilter, ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { RpcException } from '@nestjs/microservices';

@Catch(RpcException)
export class RpcCustomExceptionFilter implements ExceptionFilter {
    catch(exception: RpcException, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const rpcError = exception.getError();

        if (
            typeof rpcError === 'object'
        ) {
            const statusCode = ('statusCode' in rpcError) ? rpcError.statusCode : 400;
            return response.status(statusCode).json(rpcError);
        }

        response.status(400).json({
            status: 'error',
            message: rpcError,
            statusCode: 400,
        });
    }
}
