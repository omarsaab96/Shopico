import FloatingCartBanner from "../../components/FloatingCartBanner";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import QuantityControl from "../../components/QuantityControl";
import Text from "../../components/Text";
import { formatQuantity, priceBasis, quantityStep, roundAmount } from "../../lib/productUnits";
import api from "../../lib/api";
import { useCart } from "../../lib/cart";
import { useTheme } from "../../lib/theme";
import { useI18n } from "../../lib/i18n";
import { useCurrency } from "../../lib/currency";

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const productId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const [product, setProduct] = useState<any>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [quantityValid, setQuantityValid] = useState(true);
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [imageIndex, setImageIndex] = useState(0);
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const { addItem, items, setQuantity } = useCart();
  const cartItemCount = items.length;
  const cartSubtotal = roundAmount(items.reduce((sum, item) => item.unavailable ? sum : sum + roundAmount(item.price * item.quantity), 0));
  const { palette } = useTheme();
  const { isRTL } = useI18n();
  const { selectedCurrency, formatMoney } = useCurrency();
  const styles = useMemo(() => createStyles(palette, isRTL), [palette, isRTL]);
  const tr = (en: string, ar: string) => isRTL ? ar : en;

  const loadProduct = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get(`/products/${productId}`);
      const next = res.data.data;
      setProduct(next);
      setSelectedQuantity(quantityStep(next));
      setQuantityValid(true);
      setImageIndex(0);
      setFailedImages([]);
      const first = (next.variants || []).find((v: any) => (v.isAvailable ?? next.isAvailable) !== false && v.isPublic !== false);
      setSelectedVariantId(first?._id || "");
    } catch { setError(true); }
    finally { setLoading(false); }
  }, [productId]);
  useEffect(() => { void loadProduct(); }, [loadProduct]);

  const categories = (product?.categories || []).filter((category: any) => category?._id && category?.name);
  const variants = (product?.variants || []).filter((v: any) => v.isPublic !== false);
  const variant = variants.find((v: any) => v._id === selectedVariantId);
  const originalPrice = Number(variant?.price ?? product?.price ?? 0);
  const promoPrice = variant?.promoPrice ?? product?.promoPrice;
  const price = Number((variant?.isPromoted ?? product?.isPromoted) && promoPrice !== undefined ? promoPrice : originalPrice);
  const discounted = price < originalPrice;
  const images = (variant?.images?.length ? variant.images : product?.images) || [];
  const imageUrl = images[imageIndex]?.url;
  const existing = items.find(item => item.productId === product?._id && (item.variantId || "") === selectedVariantId && (item.unit || "piece") === (product?.unit || "piece") && !item.unavailable);
  const quantity = existing?.quantity ?? selectedQuantity;
  const measured = product?.unit === "g" || product?.unit === "ml";
  const available = product?.isPublic !== false && (variant?.isAvailable ?? product?.isAvailable) !== false && (!variants.length || Boolean(variant));
  const total = roundAmount(price * quantity);
  const labelVariant = (v: any) => Object.values(v.attributes || {}).join(" · ") || v.sku || v.barcode || tr("Option", "خيار");
  const changeQuantity = (next: number) => {
    if (existing) {
      setSelectedQuantity(next > 0 ? next : quantityStep(product));
      if (next <= 0) setQuantityValid(true);
      setQuantity(existing.productId, next, existing.variantId);
    } else setSelectedQuantity(Math.max(1, next));
  };
  const addToCart = () => {
    if (!available || !quantityValid || existing) return;
    addItem({
      productId: product._id, variantId: variant?._id, variantAttributes: variant?.attributes,
      name: product.name, price, originalPrice: discounted ? originalPrice : undefined,
      isPromoted: discounted, image: images[0]?.url, unit: product.unit || "piece", unitLabel: product.unitLabel, quantity
    });
  };

  return <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
    <View style={styles.header}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={tr("Back", "رجوع")}
        onPress={() => router.canGoBack() ? router.back() : router.replace("/home")}
        style={styles.iconButton}>
        <Feather name={isRTL ? "arrow-right" : "arrow-left"} size={21} color={palette.text} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{tr("Product details", "تفاصيل المنتج")}</Text>
      <View style={styles.headerSpacer} />
    </View>
    {loading ? <View style={styles.empty}><ActivityIndicator color={palette.accent} size="large" /></View> : error || !product ? <View style={styles.empty}>
      <Feather name="wifi-off" size={32} color={palette.muted} /><Text style={styles.sectionTitle}>{tr("Couldn’t load this product", "تعذر تحميل المنتج")}</Text>
      <TouchableOpacity accessibilityRole="button" onPress={() => void loadProduct()} style={styles.retry}><Text style={styles.buttonText}>{tr("Try again", "حاول مجدداً")}</Text></TouchableOpacity>
    </View> : <KeyboardAvoidingView style={styles.body} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, cartItemCount > 0 && { paddingBottom: 100 }]}>

        <View style={styles.imageStage}>
          {/* <View style={styles.imageCircle} /> */}
          {imageUrl && !failedImages.includes(imageUrl) ? <Image accessibilityLabel={product.name} source={{ uri: imageUrl }} style={styles.heroImage} resizeMode="contain" onError={() => setFailedImages(current => [...current, imageUrl])} /> : <Image source={require("../../assets/shopico_logo-black.png")} style={styles.fallbackImage} resizeMode="contain" />}
          {images.length > 1 && <View style={styles.imageCount}><Feather name="image" size={12} color={palette.text} /><Text style={styles.imageCountText}>{imageIndex + 1} / {images.length}</Text></View>}
        </View>

        {images.length > 1 && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbnails}>
          {images.map((image: any, index: number) => <TouchableOpacity key={`${image.url}-${index}`} accessibilityRole="button" accessibilityLabel={`${tr("Product image", "صورة المنتج")} ${index + 1}`} accessibilityState={{ selected: imageIndex === index }} onPress={() => setImageIndex(index)} style={[styles.thumbnail, index === imageIndex && styles.thumbnailSelected]}><Image source={{ uri: image.url }} style={styles.thumbnailImage} resizeMode="contain" /></TouchableOpacity>)}
        </ScrollView>}

        {categories.length > 0 && <View style={styles.categories}>
          {categories.map((category: any) => <TouchableOpacity
            key={category._id}
            accessibilityRole="link"
            onPress={() => router.push({ pathname: "/categories/[id]", params: { id: category._id } })}
            style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{category.name}</Text>
          </TouchableOpacity>)}
        </View>}

        <View style={[styles.summary]}>
          {/* <View style={styles.availability}><View style={[styles.statusDot, { backgroundColor: available ? "#24815C" : palette.muted }]} /><Text style={[styles.availabilityText, { color: available ? "#24815C" : palette.muted }]}>{available ? tr("Available to order", "متوفر للطلب") : tr("Currently unavailable", "غير متوفر حالياً")}</Text></View> */}
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{product.name}</Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {measured &&
                <Text style={{ borderWidth: 1, borderColor: "rgba(15, 23, 42, 0.08)", paddingHorizontal: 4, borderRadius: 5, fontSize: 14 }}>
                  {priceBasis(product, isRTL)}
                </Text>
              }
            </View>
          </View>

          <View style={[
            { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 30 }
          ]}>
            <View style={styles.priceRow}>
              {discounted &&
                <View style={styles.saleBadge}>
                  {/* <Feather name="tag" size={13} color="#fff" /> */}
                  <Text style={styles.saleText}>{Math.round((1 - price / originalPrice) * 100)}% {tr("OFF", "خصم")}</Text>
                </View>
              }

              <Text style={styles.price}>
                {formatMoney(price * quantityStep(product), selectedCurrency)}
              </Text>

              {discounted &&
                <Text style={styles.oldPrice}>
                  {formatMoney(originalPrice * quantityStep(product), selectedCurrency)}
                </Text>
              }
            </View>
          </View>
        </View>

        {!!product.description?.trim() &&
          <View style={[styles.section, { borderTopWidth: 0 }]}>
            <Text style={styles.sectionTitle}>
              {tr("About this product", "عن المنتج")}
            </Text>
            {/* <Text style={styles.description}>
              {product.description}
            </Text> */}
          </View>
        }


        {variants.length > 0 && <View style={styles.section}>
          <Text style={styles.sectionTitle}>{tr("Choose an option", "اختر النوع")}</Text>
          <View style={styles.variantGrid}>{variants.map((option: any) => {
            const disabled = (option.isAvailable ?? product.isAvailable) === false;
            const selected = selectedVariantId === option._id;
            return <TouchableOpacity key={option._id} disabled={disabled} accessibilityRole="button" accessibilityState={{ selected, disabled }} onPress={() => { setSelectedVariantId(option._id); setImageIndex(0); setQuantityValid(true); }} style={[styles.variant, selected && styles.variantSelected, disabled && styles.disabled]}><Text style={[styles.variantText, selected && styles.variantTextSelected]}>{labelVariant(option)}</Text>{selected && <Feather name="check" size={16} color={palette.accent} />}</TouchableOpacity>;
          })}</View>
        </View>}

        {available && <View style={styles.section}>
          {existing ? <>
            {/* <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>
                {measured ? tr("Choose your amount", "اختر الكمية") : tr("Quantity", "الكمية")}
              </Text>
              
              {existing && <Text style={styles.inCart}>{tr("In your cart", "في سلتك")}</Text>}
            </View> */}

            {measured ? (
              <View style={styles.presets}>
                {[100, 250, 500, 1000].map(amount =>
                  <TouchableOpacity key={amount} accessibilityRole="button" accessibilityState={{ selected: quantity === amount }}
                    onPress={() => {
                      changeQuantity(amount);
                      setQuantityValid(true);
                    }}
                    style={[
                      styles.preset,
                      quantity === amount && styles.presetSelected
                    ]}>
                    <Text style={[
                      styles.presetText,
                      quantity === amount && styles.variantTextSelected
                    ]}>
                      {formatQuantity(amount, product, isRTL)}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={styles.presets}>
                {[1, 2, 5, 10].map(amount =>
                  <TouchableOpacity key={amount} accessibilityRole="button" accessibilityState={{ selected: quantity === amount }}
                    onPress={() => {
                      changeQuantity(amount);
                      setQuantityValid(true);
                    }}
                    style={[
                      styles.preset,
                      quantity === amount && styles.presetSelected
                    ]}>
                    <Text style={[
                      styles.presetText,
                      quantity === amount && styles.variantTextSelected
                    ]}>
                      {formatQuantity(amount, product, isRTL)}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <View style={styles.quantityBox}>
              <View style={{ flex: 1 }}>
                <QuantityControl
                  pill
                  fullwidth
                  key={`${product._id}:${selectedVariantId}`}
                  quantity={quantity}
                  product={product}
                  onChange={changeQuantity}
                  onValidationChange={setQuantityValid}
                  allowRemove={Boolean(existing)}
                />
              </View>
              <View style={styles.totalBlock}>

                {/* <Text style={styles.totalLabel}>
                  {measured && `${formatQuantity(quantity, product, isRTL)}`}
                </Text> */}

                <Text numberOfLines={1} adjustsFontSizeToFit style={styles.total}>
                  = {formatMoney(total, selectedCurrency)}
                </Text>
              </View>
            </View>


          </> : <TouchableOpacity accessibilityRole="button" disabled={!quantityValid} onPress={addToCart} style={[styles.cartAction, !quantityValid && styles.disabled]}>
            <Feather name="plus" size={19} color="#fff" /><Text style={styles.buttonText}>{tr("Add to cart", "أضف إلى السلة")}</Text>
          </TouchableOpacity>}
        </View>}

      </ScrollView>
      <FloatingCartBanner count={cartItemCount} subtotal={formatMoney(cartSubtotal, selectedCurrency)} onPress={() => router.push("/(tabs)/cart")} horizontalInset={20} />
    </KeyboardAvoidingView>}
  </SafeAreaView>;
}

const createStyles = (p: any, rtl: boolean) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: p.background }, body: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: p.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: p.border
  },
  headerSpacer: { width: 44 },
  headerTitle: { color: p.text, fontSize: 15, fontWeight: "700" },
  content: { paddingHorizontal: 20, paddingBottom: 28, gap: 20 },
  imageStage: { borderWidth:1,borderColor:p.border,height: 200, backgroundColor: "#fff", borderRadius: 28, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  imageCircle: { position: "absolute", width: 245, height: 245, borderRadius: 123, backgroundColor: "#FFE7D4" },
  heroImage: { width: "100%", height: "100%" },
  fallbackImage: { width: "52%", height: 110, opacity: 0.3 },
  saleBadge: { flexDirection: "row", gap: 6, alignItems: "center" },
  saleText: { color: p.muted, fontSize: 12, },
  imageCount: { position: "absolute", bottom: 14, right: 14, backgroundColor: "#ffffffE6", borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5, flexDirection: "row", alignItems: "center", gap: 5 },
  imageCountText: { fontSize: 11, color: p.text },
  thumbnails: { gap: 10, flexDirection: "row", paddingHorizontal: 2 },
  thumbnail: { width: 58, height: 58, borderRadius: 14, borderWidth: 1, borderColor: p.border, backgroundColor: p.card, padding: 5 },
  thumbnailSelected: { borderColor: p.accent, borderWidth: 2 }, thumbnailImage: { width: "100%", height: "100%" },
  summary: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 40 },
  availability: { flexDirection: "row", alignItems: "center", gap: 6 }, statusDot: { width: 6, height: 6, borderRadius: 3 }, availabilityText: { fontSize: 11, fontWeight: "700" },
  name: { color: p.text, fontSize: 25, lineHeight: 30, fontWeight: "800", textAlign: rtl ? "right" : "left", marginBottom: 5 },
  categories: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  categoryBadge: { borderWidth: 1, borderColor: p.border, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 1 },
  categoryText: { color: p.muted, fontSize: 12, textAlign: rtl ? "right" : "left" },
  priceRow: {
    // flexDirection: "row",
    alignItems: "flex-end",
    gap: 0,
  },
  price: { color: p.accent, fontSize: 25, fontWeight: "900", lineHeight: 25 },
  priceUnit: { color: p.muted, fontSize: 13 },
  oldPrice: { color: p.muted, fontSize: 14, textDecorationLine: "line-through" },
  section: { paddingTop: 20, borderTopWidth: 1, borderTopColor: p.border, gap: 14 }, sectionHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { color: p.text, fontSize: 16, fontWeight: "800", textAlign: rtl ? "right" : "left" }, inCart: { color: "#24815C", fontSize: 11, fontWeight: "700" },
  variantGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 }, variant: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: p.border, backgroundColor: p.card }, variantSelected: { borderColor: p.accent, backgroundColor: "#FFF1E6" }, variantText: { color: p.text, fontSize: 13, fontWeight: "600" }, variantTextSelected: { color: "#B94700", fontWeight: "800" },
  presets: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  preset: { flex: 1, alignItems: "center", paddingVertical: 5, borderWidth: 1, borderColor: p.border, borderRadius: 15, backgroundColor: p.card },
  presetSelected: { backgroundColor: "#FFF1E6", borderColor: p.accent },
  presetText: { color: p.muted, fontSize: 12, fontWeight: "600" },
  quantityBox: { flexDirection: "row", alignItems: 'center', gap: 10, alignSelf: "flex-start", minHeight: 38 },
  description: { color: p.muted, fontSize: 14, lineHeight: 24, textAlign: rtl ? "right" : "left" },
  totalBlock: { gap: 10, flexDirection: 'row', alignItems: 'center' },
  totalLabel: { color: p.muted, fontSize: 11 },
  total: { color: p.muted, fontSize: 12, fontWeight: "600" },
  cartAction: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, paddingHorizontal: 22, minHeight: 54, borderRadius: 17, backgroundColor: p.accent }, buttonText: { color: "#fff", fontWeight: "800", fontSize: 14 }, disabled: { opacity: 0.4 }, empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 20, padding: 24 }, retry: { paddingHorizontal: 25, paddingVertical: 14, borderRadius: 14, backgroundColor: p.accent },
});
