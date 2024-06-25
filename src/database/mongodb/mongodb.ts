import { connect } from 'mongoose';
import { config } from 'dotenv';
import { getDatabaseName, getMongodbUri } from '../../config';
config();
const connectToMongo = async () => { 
  const MONGODB_URI = getMongodbUri();
  const DATABASE_NAME = getDatabaseName();
  const connection= MONGODB_URI + "/" + DATABASE_NAME;
  await connect(connection, {});
};

export default connectToMongo;
