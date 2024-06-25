import { Model, model, Schema } from "mongoose";

export interface IDiscover extends Document {
  url: string;
  title: string;
  content: string;
}

const discoverSchema = new Schema<IDiscover>({
url: { type: String, required: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
});

const DiscoverModel: Model<IDiscover> = model('Discover', discoverSchema);
export default DiscoverModel;

