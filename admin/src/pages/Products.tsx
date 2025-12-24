import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Card from "../components/Card";
import type { Category, Product, ProductImage } from "../types/api";
import { deleteProduct, fetchCategories, fetchProducts, getImageKitAuth, saveProduct } from "../api/client";

const uploadUrl = import.meta.env.VITE_IMAGEKIT_UPLOAD_URL || "https://upload.imagekit.io/api/v1/files/upload";

const ProductsPage = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [draft, setDraft] = useState<Partial<Product>>({ images: [] });
  const [uploadingNew, setUploadingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Product>>({});
  const [editUploadingId, setEditUploadingId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [editError, setEditError] = useState("");

  const load = () => {
    fetchProducts().then(setProducts).catch(console.error);
    fetchCategories().then(setCategories).catch(console.error);
  };

  useEffect(() => {
    load();
  }, []);

  const uploadToImageKit = async (
    file: File,
    onDone: (img: ProductImage) => void,
    setUploading: (v: boolean) => void,
    onError: (msg: string) => void
  ) => {
    setUploading(true);
    try {
      const auth = await getImageKitAuth();
      const publicKey = auth.publicKey || import.meta.env.VITE_IMAGEKIT_PUBLIC_KEY;
      const form = new FormData();
      form.append("file", file);
      form.append("fileName", file.name);
      form.append("token", auth.token);
      form.append("signature", auth.signature);
      form.append("expire", String(auth.expire));
      if (publicKey) form.append("publicKey", publicKey);
      const res = await fetch(uploadUrl, { method: "POST", body: form });
      const data = (await res.json()) as { url?: string; fileId?: string; message?: string };
      if (!res.ok || !data?.url || !data?.fileId) {
        const msg = data?.message || "Upload failed";
        throw new Error(msg);
      }
      onDone({ url: data.url, fileId: data.fileId });
    } catch (err: any) {
      const message = err?.message || "Image upload failed";
      onError(message);
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const saved = await saveProduct(draft);
    setDraft({ images: [] });
    setProducts((prev) => {
      const exists = prev.find((p) => p._id === saved._id);
      if (exists) return prev.map((p) => (p._id === saved._id ? saved : p));
      return [saved, ...prev];
    });
  };

  const startEdit = (p: Product) => {
    setEditingId(p._id);
    setEditDraft(p);
    setEditError("");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      const payload = { ...editDraft, _id: editingId };
      const saved = await saveProduct(payload);
      setProducts((prev) => prev.map((p) => (p._id === saved._id ? saved : p)));
      setEditingId(null);
      setEditDraft({});
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Update failed";
      setEditError(msg);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft({});
    setEditError("");
  };

  return (
    <div className="grid row-3col">
      <Card title="New Product" subTitle="">
        <form className="form" onSubmit={submit}>
          <label>
            Name
            <input value={draft.name || ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
          </label>
          <label>
            Description
            <input
              value={draft.description || ""}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="Short blurb"
            />
          </label>
          <label>
            Price (SYP)
            <input
              type="number"
              value={draft.price || ""}
              onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })}
              required
            />
          </label>
          <label>
            Stock
            <input type="number" value={draft.stock || 0} onChange={(e) => setDraft({ ...draft, stock: Number(e.target.value) })} />
          </label>
          <label>
            Category
            <select value={(draft.category as string) || ""} onChange={(e) => setDraft({ ...draft, category: e.target.value })} required>
              <option value="">Select</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label style={{ margin: 0 }}>
            Images ({draft.images?.length})
          </label>



          <div className="thumb-row">
            {draft.images?.length == 0 ? (
              <div className="defaultImage big">
                <img src="productIcon.png" alt="" />
              </div>
            ) : (
              (draft.images as ProductImage[] | undefined)?.map((img) => (
                <div key={img.fileId} className="thumb">
                  <img src={img.url} alt="" />
                </div>
              ))
            )}

            <div className="uploadDiv inline">
              <label htmlFor="prodImgUpload" className="uploadBtn">
                {uploadingNew ? 'Uploading...' : 'Upload'}
              </label>
              <input
                type="file"
                id="prodImgUpload"
                accept="image/*"
                className="uploadForm"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file)
                    uploadToImageKit(
                      file,
                      (img) => setDraft((d) => ({ ...d, images: [...((d.images as ProductImage[]) || []), img] })),
                      setUploadingNew,
                      (msg) => setFormError(msg)
                    );
                }}
                disabled={uploadingNew}
              />
            </div>
          </div>


          {formError && <div className="error">{formError}</div>}
          <button className="primary" type="submit">
            Save Product
          </button>
        </form>
      </Card>

      <Card title="Products" subTitle={`(${products.length})`}>
        <table className="table">
          <thead>
            <tr>
              <th>Image</th>
              <th>Name</th>
              <th>Price</th>
              <th>Stock</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product._id} className="productRow">
                <td>
                  {editingId === product._id ? (
                    <>
                      <div className="uploadDiv">
                        <label htmlFor={`prodImg${product._id}`} className="uploadBtn">
                          {editUploadingId === product._id ? 'Uploading...' : 'Upload'}
                        </label>
                        <input
                          type="file"
                          id={`prodImg${product._id}`}
                          className="uploadForm"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setEditUploadingId(product._id);
                              uploadToImageKit(
                                file,
                                (img) =>
                                  setEditDraft((prev) => ({
                                    ...prev,
                                    images: [...((prev.images as ProductImage[]) || []), img],
                                  })),
                                (flag) => (flag ? setEditUploadingId(product._id) : setEditUploadingId(null)),
                                (msg) => setEditError(msg)
                              );
                            }
                          }}
                          disabled={editUploadingId === product._id}
                        />
                      </div>

                    </>
                  ) : (
                    product.images?.[0]?.url ? (
                      <div className="listImage" >
                        <img src={product.images[0].url} alt={product.name} />
                      </div>
                    ) : (
                      <div className="defaultImage">
                        <img src="productIcon.png" alt="" className="medium" />
                      </div>
                    )
                  )}

                </td>
                <td>
                  {editingId === product._id ? (
                    <input value={editDraft.name || ""} onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })} />
                  ) : (
                    product.name
                  )}
                </td>
                <td>
                  {editingId === product._id ? (
                    <input
                      type="number"
                      value={editDraft.price ?? product.price}
                      onChange={(e) => setEditDraft({ ...editDraft, price: Number(e.target.value) })}
                    />
                  ) : (
                    product.price.toLocaleString()
                  )}
                </td>
                <td>
                  {editingId === product._id ? (
                    <input
                      type="number"
                      value={editDraft.stock ?? product.stock}
                      onChange={(e) => setEditDraft({ ...editDraft, stock: Number(e.target.value) })}
                    />
                  ) : (
                    product.stock
                  )}
                </td>

                <td style={{}}>
                  {editingId === product._id ? (
                    <>
                      <button className="ghost-btn mr-10" onClick={saveEdit}>
                        Save
                      </button>
                      <button className="ghost-btn mr-10" onClick={cancelEdit}>
                        Cancel
                      </button>
                      <button className="ghost-btn danger" onClick={() => deleteProduct(product._id).then(load)}>
                        Delete
                      </button>
                      {editError && <div className="error">{editError}</div>}
                    </>
                  ) : (
                    <>
                      <button className="ghost-btn mr-10" onClick={() => startEdit(product)}>
                        Edit
                      </button>
                      <button className="ghost-btn danger" onClick={() => deleteProduct(product._id).then(load)}>
                        Delete
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
};

export default ProductsPage;
