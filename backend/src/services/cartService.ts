import { Types } from "mongoose";
import { Cart } from "../models/Cart";
import { IProduct, Product } from "../models/Product";

interface UpdateCartItem {
  productId: string;
  quantity: number;
}

interface RemovedCartItem extends UpdateCartItem {
  name?: string;
}

const getDisplayPrice = (product: IProduct) =>
  product.isPromoted && product.promoPrice !== undefined ? product.promoPrice : product.price;

export const getUserCart = async (userId: Types.ObjectId, branchId?: string) => {
  const cart = await Cart.findOne({ user: userId });
  if (!cart) return (await Cart.create({ user: userId, items: [] })).populate("items.product");

  if (branchId && cart.items.length > 0) {
    const productIds = cart.items.map((item) => item.product);
    const products = await Product.find({
      _id: { $in: productIds },
      branchId,
      isAvailable: true,
      isPublic: { $ne: false },
    }).select("_id");
    const allowedIds = new Set(products.map((product) => product._id.toString()));
    const visibleItems = cart.items.filter((item) => allowedIds.has(item.product.toString()));
    if (visibleItems.length !== cart.items.length) {
      cart.items = visibleItems;
      await cart.save();
    }
  }

  return cart.populate("items.product");
};

export const updateCart = async (userId: Types.ObjectId, branchId: string, items: UpdateCartItem[]) => {
  const productIds = items.map((i) => i.productId);
  const products = await Product.find({ _id: { $in: productIds }, branchId, isAvailable: true, isPublic: { $ne: false } });
  const productMap = new Map(products.map((p) => [p._id.toString(), p]));

  const cartItems = items.map((item) => {
    const product = productMap.get(item.productId);
    if (!product) {
      throw { status: 404, message: "Product not found" };
    }
    const price = getDisplayPrice(product);
    return {
      product: product._id,
      quantity: item.quantity,
      priceSnapshot: price,
    };
  });

  const cart = await Cart.findOneAndUpdate({ user: userId }, { items: cartItems }, { new: true, upsert: true });
  return cart;
};

export const syncCart = async (userId: Types.ObjectId, branchId: string, items: UpdateCartItem[]) => {
  const productIds = Array.from(new Set(items.map((item) => item.productId)));
  const products = await Product.find({ _id: { $in: productIds }, branchId });
  const productMap = new Map(products.map((product) => [product._id.toString(), product]));
  const removedItems: RemovedCartItem[] = [];

  const cartItems = items.flatMap((item) => {
    const product = productMap.get(item.productId);
    if (!product || !product.isAvailable || product.isPublic === false) {
      removedItems.push({ ...item, name: product?.name });
      return [];
    }
    return [{
      product: product._id,
      quantity: item.quantity,
      priceSnapshot: getDisplayPrice(product),
    }];
  });

  const cart = await Cart.findOneAndUpdate({ user: userId }, { items: cartItems }, { new: true, upsert: true });
  const syncedItems = cartItems.map((item) => {
    const product = productMap.get(item.product.toString())!;
    const image = product.images?.[0]?.url;
    return {
      productId: product._id.toString(),
      name: product.name,
      price: item.priceSnapshot,
      image,
      quantity: item.quantity,
    };
  });

  return {
    cart,
    items: syncedItems,
    removedItems,
    subtotal: syncedItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
  };
};
