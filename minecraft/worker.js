import init, { horizon_worker_entry } from "https://raw.githack.com/Camerons-Git7/Minecraft-Rust/main/rust-minecraft/pkg/horizon-client.js";

self.onmessage = async (event) => {
  const data = event.data;
  if (!data || data.module == null) return;
  const { module, memory, ptr, name } = data;
  try {
    await init({ module_or_path: module, memory });
    horizon_worker_entry(ptr);
  } catch (e) {
    console.error("Horizon worker failed:", name, e);
  }
};
