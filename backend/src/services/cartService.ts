import { Types } from "mongoose";
import { Cart } from "../models/Cart";
import { findProductVariant, getEffectiveVariantPrice, getVariantAttributes, isVariantAvailable, Product } from "../models/Product";

interface UpdateCartItem {
  productId: string;
  variantId?: string;
  quantity: number;
}

interface RemovedCartItem extends UpdateCartItem {
  name?: string;
}

export const getUserCart = async (userId: Types.ObjectId, branchId?: string) => {
  const cart = await Cart.findOne({ user: userId });
  if (!cart) return (await Cart.create({ user: userId, items: [] })).populate("items.product");

  if (branchId && cart.items.length > 0) {
    const productIds = cart.items.map((item) => item.product);
    const productMap = new Map(await Product.find({ _id: { $in: productIds }, branchId }).then((products) => products.map((product) => [product._id.toString(), product])));
    const visibleItems = cart.items.filter((item) => {
      const product = productMap.get(item.product.toString());
      if (!product || product.isPublic === false) return false;
      const variant = findProductVariant(product, item.variantId?.toString());
      if (item.variantId && !variant) return false;
      return isVariantAvailable(product, variant);
    });
    if (visibleItems.length !== cart.items.length) {
      cart.items = visibleItems;
      await cart.save();
    }
  }

  return cart.populate("items.product");
};

export const updateCart = async (userId: Types.ObjectId, branchId: string, items: UpdateCartItem[]) => {
  const productIds = items.map((i) => i.productId);
  const products = await Product.find({ _id: { $in: productIds }, branchId, isPublic: { $ne: false } });
  const productMap = new Map(products.map((p) => [p._id.toString(), p]));

  const cartItems = items.map((item) => {
    const product = productMap.get(item.productId);
    if (!product) {
      throw { status: 404, message: "Product not found" };
    }
    const variant = findProductVariant(product, item.variantId);
    if (item.variantId && !variant) throw { status: 404, message: "Product variant not found" };
    if (!isVariantAvailable(product, variant)) throw { status: 404, message: "Product not found" };
    const price = getEffectiveVariantPrice(product, variant);
    return {
      product: product._id,
      variantId: variant?._id,
      variantAttributes: getVariantAttributes(variant),
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
    const variant = product ? findProductVariant(product, item.variantId) : undefined;
    if (!product || product.isPublic === false || (item.variantId && !variant) || !isVariantAvailable(product, variant)) {
      removedItems.push({ ...item, name: product?.name });
      return [];
    }
    return [{
      product: product._id,
      quantity: item.quantity,
      variantId: variant?._id,
      variantAttributes: getVariantAttributes(variant),
      priceSnapshot: getEffectiveVariantPrice(product, variant),
    }];
  });

  const cart = await Cart.findOneAndUpdate({ user: userId }, { items: cartItems }, { new: true, upsert: true });
  const syncedItems = cartItems.map((item) => {
    const product = productMap.get(item.product.toString())!;
    const image = product.images?.[0]?.url;
    return {
      productId: product._id.toString(),
      variantId: item.variantId?.toString(),
      variantAttributes: item.variantAttributes,
      name: product.name,
      price: item.priceSnapshot,
      image: findProductVariant(product, item.variantId?.toString())?.images?.[0]?.url || image,
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
