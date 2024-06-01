import { auth } from 'google-auth-library';
import { getAccessKey } from './config';

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
  return Boolean(authHeader && token === getAccessKey());
};

export const hasGCPCredentials = async () => {
  try {
    const credentials = await auth.getCredentials();
    return Object.keys(credentials).length > 0;
  } catch (e) {
    return false;
  }
};
