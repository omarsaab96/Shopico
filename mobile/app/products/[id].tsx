import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Image, View, StyleSheet, TouchableOpacity } from "react-native";
import Button from "../../components/Button";
import Screen from "../../components/Screen";
import api from "../../lib/api";
import { useCart } from "../../lib/cart";
import { useTheme } from "../../lib/theme";
import { useI18n } from "../../lib/i18n";
import Text from "../../components/Text";
import { useCurrency } from "../../lib/currency";

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [product, setProduct] = useState<any>();
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");
  const { addItem, items, setQuantity } = useCart();
  const { palette, isDark } = useTheme();
  const { t, isRTL } = useI18n();
  const { selectedCurrency, formatMoney } = useCurrency();
  const styles = useMemo(() => createStyles(palette, isRTL), [palette, isRTL]);

  const fallbackLogo = isDark ? require("../../assets/shopico_logo.png") : require("../../assets/shopico_logo-black.png");

  useEffect(() => {
    api.get(`/products/${id}`).then((res) => {
      const nextProduct = res.data.data;
      setProduct(nextProduct);
      const firstVariant = (nextProduct.variants || []).find((variant: any) => variant.isAvailable !== false && variant.isPublic !== false);
      setSelectedVariantId(firstVariant?._id || "");
    });
  }, [id]);

  const variants = (product?.variants || []).filter((variant: any) => variant.isPublic !== false);
  const selectedVariant = variants.find((variant: any) => variant._id === selectedVariantId);
  const displayPrice = selectedVariant
    ? (selectedVariant.isPromoted ?? product?.isPromoted) && (selectedVariant.promoPrice ?? product?.promoPrice) !== undefined
      ? selectedVariant.promoPrice ?? product?.promoPrice
      : selectedVariant.price ?? product?.price
    : product?.isPromoted && product?.promoPrice !== undefined ? product.promoPrice : product?.price;
  const originalPrice = selectedVariant?.price ?? product?.price;
  const displayImages = selectedVariant?.images?.length ? selectedVariant.images : product?.images;
  const variantLabel = (variant: any) => Object.entries(variant.attributes || {}).map(([key, value]) => `${key}: ${value}`).join(" / ");
  const existing = items.find((i) => i.productId === product?._id && (i.variantId || "") === (selectedVariantId || ""));

  if (!product) return null;

  return (
    <Screen showBack backLabel={t("back") ?? "Back"}>
      <View style={styles.prodImgBox}>
        <Image
          source={displayImages?.[0]?.url ? {
            uri: displayImages?.[0]?.url
          } :
            fallbackLogo
          }
          style={[styles.img, !displayImages?.[0]?.url && styles.defaultImage]}
        />
      </View>
      <Text style={styles.name}>{product.name}</Text>
      <View style={styles.priceRow}>
        {displayPrice !== originalPrice ? (
          <Text style={styles.oldPrice}>{formatMoney(originalPrice || 0, selectedCurrency)}</Text>
        ) : null}
        <View style={{ flexDirection: 'row', justifyContent:'flex-start', alignItems: 'center', gap: 5, flex:1 }}>
          <Text style={[styles.price]}>
            {formatMoney(displayPrice || 0, selectedCurrency)}
          </Text>
        </View>
        {displayPrice !== originalPrice && originalPrice > 0 ? (
          <Text style={styles.promoBadge}>
            {Math.round((1 - displayPrice / originalPrice) * 100)}% {t("off") ?? "off"}
          </Text>
        ) : null}
      </View>
      <Text style={styles.desc}>{product.description}</Text>
      {variants.length > 0 && (
        <View style={styles.variantSection}>
          <Text style={styles.variantTitle}>{t("variants") ?? "Variants"}</Text>
          <View style={styles.variantGrid}>
            {variants.map((variant: any) => {
              const disabled = variant.isAvailable === false;
              const selected = selectedVariantId === variant._id;
              return (
                <TouchableOpacity
                  key={variant._id}
                  style={[styles.variantOption, selected && styles.variantOptionActive, disabled && styles.variantOptionDisabled]}
                  onPress={() => !disabled && setSelectedVariantId(variant._id)}
                  disabled={disabled}
                >
                  <Text style={[styles.variantOptionText, selected && styles.variantOptionTextActive]}>
                    {variantLabel(variant) || variant.sku || variant.barcode || "-"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
      {variants.length > 0 && !selectedVariant ? (
        <Text style={styles.desc}>{t("unavailable") ?? "Unavailable"}</Text>
      ) : existing ? (
        <View style={styles.qtyRow}>
          <TouchableOpacity
            style={styles.qtyButton}
            onPress={() => setQuantity(existing.productId, existing.quantity - 1, existing.variantId)}
          >
            <Text style={styles.qtySymbol}>-</Text>
          </TouchableOpacity>
          <Text style={styles.qtyValue}>{existing.quantity}</Text>
          <TouchableOpacity
            style={styles.qtyButton}
            onPress={() => {
              addItem({
                productId: product._id,
                variantId: selectedVariant?._id,
                variantAttributes: selectedVariant?.attributes,
                name: product.name,
                price: displayPrice,
                image: displayImages?.[0]?.url,
                quantity: 1,
              });
            }}
          >
            <Text style={styles.qtySymbol}>+</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Button
          title={t("addToCart")}
          onPress={() => {
            addItem({
              productId: product._id,
              variantId: selectedVariant?._id,
              variantAttributes: selectedVariant?.attributes,
              name: product.name,
              price: displayPrice,
              image: displayImages?.[0]?.url,
              quantity: 1,
            });
          }}
        />
      )}
    </Screen>
  );
}

const createStyles = (palette: any, isRTL: boolean) =>
  StyleSheet.create({
    prodImgBox: {
      width: "100%",
      height: 240,
      borderRadius: 16,
      backgroundColor: palette.surface,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
      // borderWidth: 1,
      // borderColor: hairline,
      marginBottom: 10
    },
    img: { height: '100%', aspectRatio: 4 / 3, resizeMode: "contain" },
    defaultImage: {
      tintColor: '#dedede'
    },
    name: { color: palette.text, fontSize: 24, fontWeight: "800" },
    priceRow: {
      flexDirection: isRTL ? "row-reverse" : "row",
      alignItems: "center",
      gap: 10,
      marginVertical: 4,
    },
    oldPrice: { color: palette.muted, fontSize: 14, textDecorationLine: "line-through" },
    promoBadge: {
      backgroundColor: palette.accent,
      color: "#0f172a",
      fontSize: 11,
      fontWeight: "800",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
    },
    price: { color: palette.accent, fontSize: 22, lineHeight: 24, fontWeight: '900' },
    desc: { color: palette.muted, marginBottom: 12 },
    variantSection: {
      marginBottom: 14,
      gap: 8,
    },
    variantTitle: {
      color: palette.text,
      fontSize: 14,
      fontWeight: "800",
    },
    variantGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    variantOption: {
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 9,
      backgroundColor: palette.surface,
    },
    variantOptionActive: {
      borderColor: palette.accent,
      backgroundColor: palette.accent,
    },
    variantOptionDisabled: {
      opacity: 0.45,
    },
    variantOptionText: {
      color: palette.text,
      fontSize: 13,
      fontWeight: "700",
    },
    variantOptionTextActive: {
      color: "#0f172a",
    },
    qtyRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginTop: 8,
      justifyContent: 'space-between'
    },
    qtyButton: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.border,
    },
    qtySymbol: { color: palette.text, fontSize: 20, fontWeight: "800" },
    qtyValue: { color: palette.text, fontSize: 18, fontWeight: "800", minWidth: 24, textAlign: "center" },
  });
