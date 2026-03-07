import { Request, Response, NextFunction } from 'express';

type AsyncFn<Req extends Request = Request, Res extends Response = Response> = (
    req: Req,
    res: Res,
    next: NextFunction,
) => Promise<unknown>;

/**
 * Wraps an async route handler and forwards any thrown error to next(),
 * eliminating the need for try/catch in every controller.
 */
export const asyncHandler =
    <Req extends Request = Request, Res extends Response = Response>(
        fn: AsyncFn<Req, Res>,
    ) =>
    (req: Req, res: Res, next: NextFunction): void => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
