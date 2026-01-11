import { Types } from "mongoose";
import { Cart } from "../models/Cart";
import { Product } from "../models/Product";

interface UpdateCartItem {
  productId: string;
  quantity: number;
}

export const getUserCart = async (userId: Types.ObjectId) => {
  const cart = await Cart.findOne({ user: userId }).populate("items.product");
  return cart || (await Cart.create({ user: userId, items: [] }));
};

export const updateCart = async (userId: Types.ObjectId, items: UpdateCartItem[]) => {
  const productIds = items.map((i) => i.productId);
  const products = await Product.find({ _id: { $in: productIds } });
  const productMap = new Map(products.map((p) => [p._id.toString(), p]));

  const cartItems = items.map((item) => {
    const product = productMap.get(item.productId);
    if (!product) {
      throw { status: 404, message: "Product not found" };
    }
    const price = product.isPromoted && product.promoPrice !== undefined ? product.promoPrice : product.price;
    return {
      product: product._id,
      quantity: item.quantity,
      priceSnapshot: price,
    };
  });

  const cart = await Cart.findOneAndUpdate({ user: userId }, { items: cartItems }, { new: true, upsert: true });
  return cart;
};
