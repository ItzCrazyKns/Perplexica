import {
  getAccessKey,
} from './config';

export const requireAccessKey = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (authHeader) {
        const token = authHeader.split(' ')[1];

        if (token !== getAccessKey()) {
            return res.sendStatus(403);
        }

        next();
    } else {
        res.sendStatus(401);
    }
};
