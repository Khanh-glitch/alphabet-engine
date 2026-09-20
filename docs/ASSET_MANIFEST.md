# ASSET MANIFEST — danh sách tài nguyên cần tìm

> **Cách dùng file này:** mỗi mục là một "bộ" (set) độc lập. Bạn tìm được bộ nào thì
> gửi bộ đó — **không cần đủ hết mới tích hợp được**. Mỗi bộ ghi rõ: cần gì, kích thước
> thật (đo từ code), gợi ý từ khoá tìm, và công sức tích hợp để bạn ưu tiên.
>
> **Kích thước dưới đây là đo từ code đang chạy** (`src/render/arena.ts`), không phải ước lượng.
> Cột "cần tìm" đã nhân 2× cho màn hình HiDPI.

---

## 0. LUẬT CHUNG — đọc trước khi tìm

| Yêu cầu | Chi tiết |
| --- | --- |
| **Định dạng** | `.png` nền trong suốt (RGBA). Sprite sheet thì `.png` lưới đều. |
| **Giấy phép** | **CC0 / Public Domain** ưu tiên số 1. CC-BY được nếu bạn chấp nhận ghi công trong repo. **Tránh** "free for personal use" và mọi thứ cấm dùng thương mại — repo này public trên GitHub. |
| **Góc nhìn** | Nhìn **ngang, hơi nghiêng từ trên xuống** (2.5D side view). KHÔNG dùng top-down thuần, KHÔNG dùng isometric 45°. |
| **Hướng** | Nhân vật **quay mặt sang TRÁI** (địch đi từ phải sang trái). Nếu pack chỉ có hướng phải, cứ gửi — tôi lật được. |
| **Phong cách** | Máy móc công nghiệp tối màu, viền rõ, khối chắc. Điểm nhấn ấm (cam/vàng) trên nền lạnh (xanh đen). Xem `docs/UX_UI.md` phần art direction. |
| **Nền** | Trong suốt, KHÔNG có bóng đổ cứng dưới chân — game tự vẽ bóng tiếp đất (radial, mềm). |
| **Bảng màu nền** | `#05070e` `#0a0e1a` `#131b2e` `#1a2440`. Điểm nhấn: `#f0b445` `#f2734a` `#4fd8e4` `#a274f5` `#4fd8a0` |

**Thư mục sẽ nhận file** (tôi tạo khi tích hợp):
```
public/art/enemies/    public/art/objects/    public/art/zones/
public/art/core/       public/art/bg/         public/art/fx/
public/audio/sfx/      public/audio/music/
```

---

## BỘ A — KẺ ĐỊCH ⭐ Ưu tiên cao nhất

5 sprite. Đây là thứ **xuất hiện nhiều nhất trên màn hình** và hiện tại xấu nhất.

| # | Loài | Vai trò | Trên màn hình | **Cần tìm** |
| --- | --- | --- | --- | --- |
| A1 | `mote` — Mảnh vụn | Lính bộ yếu, đi theo bầy | 52 × 47 px | **128 × 128** |
| A2 | `runner` — Kẻ chạy | Nhanh, đi rải rác | 71 × 37 px | **128 × 128** |
| A3 | `flyer` — Kẻ bay | Bay qua tường, rất quan trọng | 103 × 40 px | **192 × 128** |
| A4 | `brute` — Máy ủi | Trâu máu, đi chậm, to | 103 × 117 px | **256 × 256** |
| A5 | `boss` — Cỗ Máy Câm | Trùm cuối, to gấp 3 | 160 × 197 px | **384 × 384** |

**Gợi ý từ khoá:** `robot enemy sprite sheet`, `mech enemy 2d`, `industrial drone sprite`,
`kenney robot pack`, `side view robot sprites`.

**Yêu cầu riêng:** cả 5 con phải **nhìn ra là cùng một thế giới** — cùng một dây chuyền sản xuất.
A1–A3 là máy nhỏ, A4 là máy ủi bánh xích, A5 là cỗ máy lớn có lõi phát sáng.
Nếu pack không có bộ 5 con khớp nhau, tôi ghép nhiều nguồn được nhưng sẽ lệch tông.

---

## BỘ B — VẬT THỂ CÔNG THỨC ⭐ Ưu tiên cao

Đây là **linh hồn của game** — mỗi từ đúc ra một vật thể thật. 6 vật thể đứng + 4 vùng mặt đất.

### B1. Vật thể đứng (sprite rời)

| # | Từ | Hiện đang là | Trên màn hình | **Cần tìm** |
| --- | --- | --- | --- | --- |
| B1.1 | `BOMB` | Quả cầu đen có ngòi | 54 × 60 px | **128 × 128** |
| B1.2 | `BEE` | Con ong bay, có cánh vỗ | 54 × 47 px | **128 × 128** |
| B1.3 | `WALL` | Tấm chắn có đinh tán | 103 × 135 px | **256 × 320** |
| B1.4 | `FAN` | Quạt công nghiệp | ~68 px | **128 × 128** |
| B1.5 | `MINE` | Đĩa mìn có đèn nháy | 49 px | **128 × 128** |
| B1.6 | `SAW` | Lưỡi cưa tròn lăn | 97 px | **192 × 192** |

**Gợi ý từ khoá:** `bomb sprite`, `bee sprite`, `metal wall 2d`, `industrial fan sprite`,
`landmine sprite`, `circular saw blade sprite`, `kenney industrial`.

### B2. Vùng mặt đất (decal nhìn nghiêng — **KHÔNG phải sprite vuông**)

4 thứ này nằm **bẹt trên sàn**, nhìn từ trên xuống một góc hẹp. Tỉ lệ rất dẹt.

| # | Từ | Trên màn hình | Tỉ lệ | **Cần tìm** |
| --- | --- | --- | --- | --- |
| B2.1 | `OIL` — vũng dầu | 281 × 59 px | ~4.8 : 1 | **512 × 128** (ellipse mờ) |
| B2.2 | `WEB` — lưới | 270 × 81 px | ~3.3 : 1 | **512 × 192** |
| B2.3 | `ICE` — vùng băng | 270 × 81 px | ~3.3 : 1 | **512 × 192** (có gai băng nhô lên) |
| B2.4 | `FIRE` — vùng lửa | 248 × 256 px | ~1 : 1 | **512 × 512** (lửa bốc cao) |

**Gợi ý từ khoá:** `oil puddle top down`, `cobweb decal`, `ice patch texture`,
`fire sprite sheet loop`, `ground decal pack`.

> ⚠️ **Lưu ý quan trọng:** các vùng này cần **nhìn như nằm trên sàn**, không phải dán đè lên.
> Nếu bạn tìm được pack "top-down decal" thì tốt — tôi sẽ tự bóp dẹt theo phối cảnh.

---

## BỘ C — LÕI (cỗ máy của người chơi)

| # | Thứ | Trên màn hình | **Cần tìm** |
| --- | --- | --- | --- |
| C1 | Thân lò phản ứng | 232 × 226 px | **512 × 512** |
| C2 | Mắt lò phản ứng (phát sáng) | đường kính ~80 px | **256 × 256** |

**Gợi ý từ khoá:** `reactor core sprite`, `generator machine 2d`, `power core glowing`.

**Yêu cầu:** phải to và **có sức nặng** — đây là thứ người chơi bảo vệ suốt 8 trận.
Có bản "hư hỏng" (nứt, khói) thì càng tốt, để tôi đổi khi máu LÕI thấp.

---

## BỘ D — NỀN SÂN ĐẤU (parallax)

Sân logic là **1440 × 810**. Chia 3 lớp để tạo chiều sâu:

| # | Lớp | **Cần tìm** | Ghi chú |
| --- | --- | --- | --- |
| D1 | Tường xa (gantry, ống khói) | **2880 × 1620** | Mờ, tối, gần như đen |
| D2 | Dây chuyền giữa (băng tải, phễu chữ) | **2880 × 1620** nền trong suốt | Rõ hơn lớp 1 |
| D3 | Cấu trúc gần (cột, đèn treo) | **2880 × 1620** nền trong suốt | Đậm nhất, ở rìa |

**Gợi ý từ khoá:** `industrial background parallax`, `factory interior game background`,
`steampunk factory parallax layers`, `dark industrial 2d background`.

**Yêu cầu quan trọng:** nền phải **TỐI và ít tương phản**. Vùng chơi (dải ngang giữa màn hình,
y = 300→604) phải **thoáng** để nhân vật nổi lên. Nền rối quá sẽ phá game.

---

## BỘ E — SÀN ĐẤU

| # | Thứ | **Cần tìm** | Ghi chú |
| --- | --- | --- | --- |
| E1 | Texture mặt sàn | **1024 × 1024**, **tile được** (seamless) | Kim loại có vân, tối |

**Gợi ý từ khoá:** `metal floor texture seamless`, `sci-fi deck texture tileable`,
`dark metal plate texture`.

Sàn được vẽ theo phối cảnh (5 dải làn), nên texture chỉ cần **lặp được**, tôi tự biến đổi.

---

## BỘ F — HIỆU ỨNG

| # | Thứ | Trên màn hình | **Cần tìm** |
| --- | --- | --- | --- |
| F1 | Vụ nổ (bom + mìn) | đường kính tới 300 px | **512 × 512**, sheet 8–12 frame |
| F2 | Lửa cháy (loop) | ~184 px | **512 × 512**, sheet loop |
| F3 | Khói | ~200 px | **256 × 256**, sheet loop |
| F4 | Tia lửa / mảnh vụn | nhỏ | **256 × 256** |
| F5 | Vòng xung kích (shockwave) | 90–300 px | **512 × 512** |
| F6 | Vệt chém / tia sáng | – | **256 × 256** |

**Gợi ý từ khoá:** `explosion sprite sheet`, `fire animation sheet`, `smoke particle png`,
`spark particle`, `shockwave sprite`, `vfx sprite sheet cc0`.

---

## BỘ G — ÂM THANH ⭐ Đáng giá nhất so với công sức

Hiện tại **toàn bộ âm thanh là sóng điện tử tổng hợp** (`src/core/audio.ts` dùng WebAudio
oscillator). Nghe khô và rẻ. Thay bằng file thật sẽ cải thiện cảm giác game **nhiều nhất
trên mỗi giờ công**.

| # | File | Khi nào phát | **Cần tìm** |
| --- | --- | --- | --- |
| G1 | `ui.wav` | bấm nút | 0.1s, tiếng "tách" gọn |
| G2 | `draw.wav` | túi nhả 1 chữ | 0.15s, "tách" nhẹ kim loại |
| G3 | `craft.wav` | ghép chữ thành công | 0.5s, **phải rất đã tai** — đây là khoảnh khắc anh hùng |
| G4 | `explosion.wav` | bom/mìn nổ | 1s, nổ lớn |
| G5 | `ignite.wav` | dầu bắt lửa | 0.7s, "phù" lửa bùng |
| G6 | `kill.wav` | hạ gục địch | 0.3s, kim loại vỡ |
| G7 | `drop.wav` | chữ rơi vào kho | 0.2s, **tiếng gỗ/mềm** — viên chữ chạm đáy |
| G8 | `coreHit.wav` | LÕI trúng đạn | 0.6s, còi báo động + tiếng nện |
| G9 | `wildcard.wav` | dùng chữ `?` | 0.8s, âm thần kỳ đi lên |
| G10 | `cleared.wav` | sạch đợt | 1.5s, fanfare ngắn |
| G11 | `failed.wav` | LÕI vỡ | 2s, thất bại |
| G12 | `music.ogg` | nhạc nền loop | 60–120s, **công nghiệp, tối, tối giản** |

**Gợi ý từ khoá:** `cc0 game sfx pack`, `kenney audio`, `freesound cc0 impact`,
`industrial ambient loop`, `dark techno loop royalty free`.

**Bắt buộc:** WAV hoặc OGG. Giấy phép CC0/CC-BY.

---

## BỘ H — VIÊN CHỮ (chỉ cần 1 file!)

| # | Thứ | **Cần tìm** | Ghi chú |
| --- | --- | --- | --- |
| H1 | Khung viên chữ **trắng, KHÔNG có chữ** | **512 × 512** | Tôi tự vẽ chữ cái lên trên |

> ⚠️ **Đừng tìm 26 viên chữ riêng lẻ.** Game cần hiển thị *bất kỳ* chữ nào (kể cả chữ do
> luật máy sinh ra), nên tôi bắt buộc phải tự render ký tự lên khung. Chỉ cần **một khung
> rỗng** — kiểu viên gỗ/letterpress có bevel, viền, bóng đổ.
>
> Nếu bạn gửi 26 viên A–Z tôi vẫn dùng được, nhưng sẽ bị giới hạn và tệ hơn bản hiện tại.

---

## BỘ I — KHÔNG NÊN THAY (khuyến nghị giữ nguyên)

| Thứ | Lý do |
| --- | --- |
| **Giao diện** (khung, nút, thẻ công thức, thanh máu) | Đang dựng từ hệ thống thiết kế có token. Thay bằng ảnh sẽ **giảm** chất lượng: khó co giãn, lệch cỡ chữ, hỏng đa ngôn ngữ. |
| **Viên chữ có chữ cái** | Xem Bộ H. |
| **Phông chữ** | Đã là font thật (Archivo + JetBrains Mono, SIL OFL, file `.woff2` thật trong `public/fonts/`). Tốt rồi. |
| **Số liệu, icon trạng thái** | vector, sắc ở mọi cỡ. |

---

## TỔNG KẾT — mua gì trước

| Ưu tiên | Bộ | Lý do | Công tích hợp |
| --- | --- | --- | --- |
| **1** | **G — Âm thanh** | Cải thiện cảm giác nhiều nhất / công sức | Thấp |
| **2** | **A — Kẻ địch** | Xuất hiện nhiều nhất, đang xấu nhất | Trung bình |
| **3** | **B — Vật thể** | Linh hồn gameplay | Trung bình |
| **4** | **C — Lõi** | Chỉ 2 file, ảnh hưởng lớn | Thấp |
| **5** | **D + E — Nền & sàn** | Tạo không gian | Thấp |
| **6** | **F — Hiệu ứng** | Đẹp nhưng game vẫn chơi được nếu thiếu | Trung bình |
| **7** | **H — Khung viên chữ** | Chỉ 1 file | Thấp |

**Nhỏ nhất mà vẫn đáng kể:** Bộ **C** (2 file) + Bộ **G** (12 file) — 14 file, thay đổi rõ rệt.

---

## CÁCH GỬI CHO TÔI

Bạn không cần đóng gói cầu kỳ. Chỉ cần:

- **Upload file trực tiếp vào chat**, hoặc
- **Nén thành .zip rồi upload** (tiện nhất nếu nhiều file), hoặc
- **Gửi link tải** nếu bạn tải được từ máy bạn.

Kèm giúp tôi **1 dòng về giấy phép** (ví dụ "CC0" hoặc "CC-BY, tác giả Kenney") để tôi ghi
vào `docs/ASSETS.md` cho đúng.

Tôi sẽ tự: đổi tên file cho khớp, thêm code nạp sprite, **giữ bản vẽ vector làm phương án dự
phòng** khi ảnh thiếu, rồi render ảnh kiểm tra từng màn hình trước khi báo xong.
