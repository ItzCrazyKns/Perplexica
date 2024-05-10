import {
  getAccessKey,
} from './config';

export const requireAccessKey = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (authHeader) {
        if (!checkAccessKey(authHeader)) {
            return res.sendStatus(403);
        }
        next();
    } else {
        res.sendStatus(401);
    }
};

export const checkAccessKey = (authHeader) => {
      const token = authHeader.split(' ')[1];
      return Boolean(authHeader && (token === getAccessKey()));
};
