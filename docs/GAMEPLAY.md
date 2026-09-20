# ALPHABET ENGINE — Đặc tả Gameplay

> **Mục đích tài liệu này.** Mô tả **game đang chạy thật**, không phải ý tưởng thiết kế.
> Mọi con số dưới đây đọc trực tiếp từ code (đường dẫn file/`hằng số` được ghi kèm) nên có thể
> kiểm chứng lại được. Chỗ nào code làm khác tài liệu, chỗ đó ghi rõ ở **§16 SAI LỆCH**.
>
> **Đối tượng đọc:** người kiểm tra lại implementation. Nếu bạn tìm thấy điểm nào trong tài liệu
> không khớp với code → đó là lỗi của tài liệu, hãy báo lại kèm `file:line`.

**Trạng thái tài liệu:** viết tại commit `79865f8` (nhánh `arena/01a0be44-alphabet-engine`),
cộng thêm **3 bản vá** thực hiện cùng lúc với tài liệu này (§16.A1, §16.A2, §16.A3).

---

## 0. TÓM TẮT MỘT ĐOẠN

Bạn không điều khiển nhân vật. Bạn sở hữu một **cỗ máy chữ**: một túi chữ tự nhả chữ xuống
kho theo nhịp, và mỗi **công thức** (một từ tiếng Anh, ví dụ `BOMB`) tự động tiêu thụ đúng
số chữ trong kho để **đúc ra một vật thể thật** — quả bom biết lăn vào chỗ đông rồi nổ, bức
tường biết chặn đường, vũng dầu biết bắt lửa. Kẻ địch đi từ phải sang trái để đập vỡ **LÕI**,
và trên đầu chúng **mang chữ**. Giết kẻ mang chữ → chữ rơi vào kho → kho đủ chữ → công thức
tự ghép tiếp → vật thể mới lại giết tiếp. Vòng lặp đó gọi là **chuỗi (cascade)**, và nó tự chạy.
Can thiệp duy nhất của người chơi trong trận là **chữ `?`** — điền đúng *một* chữ còn thiếu
để ép một công thức hoàn thành ngay.

Thắng/thua: giữ LÕI không vỡ qua **8 trận**. Máu LÕI **mang sang trận sau**, chỉ hồi lại một phần.

---

## 1. VÒNG LẶP CỐT LÕI

Chuỗi nhân quả mà toàn bộ game phải phục vụ (nguyên văn `AGENTS.md`):

```
INPUT NGẪU NHIÊN → CỖ MÁY DO NGƯỜI CHƠI ĐỊNH HÌNH → DỰ BÁO ĐỌC ĐƯỢC
→ CAN THIỆP NHỎ → KẾT QUẢ CỤ THỂ → CHỮ SINH RA TỪ TRẬN ĐÁNH
→ CHUỖI TỰ NUÔI → LÝ THUYẾT BUILD → THÊM MỘT TRẬN NỮA
```

Bốn điểm luật bất khả xâm phạm (`AGENTS.md`):

1. **Từ phải trở thành vật thể.** `BOMB` là quả bom biết lăn và nổ. Không bao giờ `BOMB = +30 sát thương`.
2. **Từ vựng được biên soạn.** Không gõ tự do, không tra từ điển, không ô chữ.
3. **Ngẫu nhiên tạo ra vấn đề; người chơi định hình câu trả lời.** Ngẫu nhiên quyết định
   thứ tự chữ, lựa chọn thưởng và bố cục trận đánh — **không bao giờ** quyết định một cỗ máy
   đã lên kế hoạch có được phép chạy hay không, và không có miss/crit ngẫu nhiên.
4. **Đúng 3 công thức trang bị**, dùng chung một kho chữ, một can thiệp (chữ `?`).

---

## 2. LUỒNG MÀN HÌNH

```
Tiêu đề → [CÁCH CHƠI] → Chọn bộ khởi đầu → ┌─ Trận 1..8 ─→ Chiến lợi phẩm ┐
                                            └───────────←───────────────┘
                                                   ↓ (thắng trận 8 / vỡ LÕI)
                                              Tổng kết
```

| Màn | File | Ghi chú |
| --- | --- | --- |
| Tiêu đề | `src/ui/screens/title.ts` | Tự mở **CÁCH CHƠI** ở lần chơi đầu (cờ `store.settings.seenHowto`) |
| Cách chơi | `src/ui/screens/howto.ts` | 4 thẻ; mở lại từ nút `CÁCH CHƠI` ngoài menu hoặc nút `?` trong trận |
| Chọn bộ | `src/ui/screens/kit.ts` | 3 bộ, nhập mã ván (seed) |
| Trận đánh | `src/ui/screens/battle.ts` | Vòng lặp mô phỏng bước cố định `1/120s` |
| Chiến lợi phẩm | `src/ui/screens/spoils.ts` | 3 lựa chọn, chọn 1 |
| Tổng kết | `src/ui/screens/summary.ts` | Thống kê + điểm |
| Sổ tay / Cài đặt / Tạm dừng | `codex.ts`, `settings.ts`, `pause.ts` | |

Chạy lại được giữa chừng: `store.suspendedRun` lưu vào `localStorage`, mở lại game sẽ vào
thẳng trận đang dở.

---

## 3. KINH TẾ CHỮ

### 3.1 Túi chữ (`src/alphabet/bag.ts`, `src/content/tuning.ts`)

- Túi là **danh sách chữ hữu hạn**. Xáo trộn có seed, rút **không hoàn lại** cho tới khi hết túi.
- Hết túi → **xáo lại**, `cycle` (vòng) tăng 1.
- Nhịp nhả chữ: `drawInterval = 0.55s`. Đầu trận chờ `drawDelay = 0.9s` để bàn đấu đọc được trước.
- lần rút **đầu tiên của vòng mới** được đánh dấu `cycleStart = true`; lần rút **cuối cùng
  của vòng** được đánh dấu `cycleEnd = true`.

**Vòng mới cắt chuỗi.** Khi túi sang vòng mới, biến `cycleSinceCraft` bật lên và **lần ghép kế
tiếp sẽ reset chuỗi về 1**, dù có ghép trong cửa sổ thời gian đi nữa. Đây là chủ ý: một vòng
túi mới là "kinh tế", không phải "chuỗi". HUD có nhịp sáng vàng ở ô TÚI khi vòng mới bắt đầu.

Luật máy tác động lên túi: `firstVowelDuplicated` (nguyên âm đầu vòng được nhân đôi),
`lastTileCopied` (viên cuối vòng được nhân đôi), `consonantInject` (đầu mỗi trận thêm 1 `B`).

### 3.2 Kho chữ (`src/alphabet/pool.ts`)

- **Mọi** chữ người chơi có trong trận đều nằm ở kho: chữ từ túi, chữ nhặt từ xác địch, chữ
  do luật máy thưởng, chữ hoàn lại, chữ do `?` tạo ra.
- Chữ mới vào có hiệu ứng bay `letterFlight = 0.55s` rồi mới "đứng yên".
- Thanh kho hiển thị gộp theo chữ cái A→Z kèm số lượng (ví dụ `B ×2  M  O`).

### 3.3 Ghép (`src/battle/battle.ts` → `resolveCrafts`)

Thứ tự giải quyết — **đây là luật quan trọng nhất của game**:

1. Duyệt ô 0 → 1 → 2. **Ô bên trái thắng** khi nhiều công thức cùng đủ chữ.
2. Một công thức ghép được khi: kho có **đủ multiset chữ** của recipe **và** số vật thể cùng
   loại đang sống **chưa đạt `limit`**.
3. Tiêu thụ **chữ cũ nhất trước** (hàng đợi FIFO), nên kho rút cạn theo thứ tự đọc được.
4. Sau khi tiêu thụ, công thức vào **nhịp hoàn thành** (xem dưới) rồi vật thể mới xuất hiện.
5. Sau khi đúc xong, `resolveCrafts` **chạy lại ngay** — nên nhiều công thức có thể hoàn thành
   liên tiếp trong cùng một khung hình. Đây chính là cơ chế tạo chuỗi.
6. Chốt an toàn: tối đa `maxCraftsPerTick = 24` lần ghép mỗi nhịp để một nền kinh tế lỗi
   không treo được khung hình.

**Nhịp hoàn thành chữ** (`BEAT`, đơn vị giây) — đây là "khoảnh khắc anh hùng" bắt buộc phải nhìn thấy:

| Pha | Thời lượng | Việc gì xảy ra |
| --- | --- | --- |
| `gather` | 0.36s | các chữ trong kho bay về thẻ công thức |
| `lock` | 0.20s | từ khoá lại, các ô chữ ấn xuống |
| `emerge` | 0.26s | vật thể hiện ra trên sân |

→ Tổng **0.82s** từ lúc đủ chữ tới lúc vật thể xuất hiện.

**`resolveCrafts` được gọi từ 2 nơi:** sau mỗi lần túi nhả chữ, và **sau mỗi lần có kẻ địch
chết**. Điểm thứ hai là lý do tồn tại của cả game: giết địch → chữ rơi → ghép ngay → vật thể
mới → giết tiếp.

---

## 4. MƯỜI CÔNG THỨC (`src/content/blueprints.ts`)

`limit` = số vật thể cùng loại được phép tồn tại đồng thời. Vượt `limit` thì công thức **không
ghép**, chữ ở lại kho.

| Từ | Nghĩa (VI) | Recipe | `limit` | Tag | Gắn sao | Hiệu ứng thật trong mô phỏng |
| --- | --- | --- | --- | --- | --- | --- |
| `BOMB` | Bom | B O M B | 4 | EXPLOSIVE, PUSHABLE, GROUND | ★ | Lăn tới chỗ đông nhất, nổ khi chạm hoặc hết ngòi |
| `FIRE` | Lửa | F I R E | 2 | BURNING, AREA | ★ | Vùng cháy cố định, giữ làn, bén sang dầu |
| `BEE` | Ong | B E E | 4 | FLYING, HUNTER | ★ | Bay qua vật cản, ưu tiên kẻ mang chữ, cắn liên tục |
| `WALL` | Tường | W A L L | 4 | BLOCKING, STRUCTURE | ★ | Chặn đường đi bộ, dồn địch thành cụm |
| `FAN` | Quạt | F A N | 3 | PUSH, UTILITY | ★ | Đẩy lính bộ và **đẩy cả bom** đi nhanh hơn |
| `OIL` | Dầu | O I L | 2 | LIQUID, FLAMMABLE, SETUP | ★ | Vũng trơn không sát thương; gặp lửa thành biển lửa |
| `MINE` | Mìn | M I N E | 3 | EXPLOSIVE, SETUP | | Nằm im, chờ, nổ khi có lính bộ tới gần |
| `SAW` | Cưa | S A W | 2 | GROUND, HEAVY | | Lưỡi cưa lăn sang phải, cắt mọi thứ trên đường |
| `WEB` | Lưới | W E B | 2 | AREA, SETUP | | Giữ chân lính bộ, kéo chúng vào giữa |
| `ICE` | Băng | I C E | 2 | AREA, UTILITY | | Đóng băng vùng; mục tiêu đông cứng ăn nổ nặng hơn |

★ = có trong bộ khởi đầu (6 từ). 4 từ còn lại (`MINE`, `SAW`, `WEB`, `ICE`) **chỉ lấy được qua thưởng**.

**Số liệu hành vi** (`TUNE`, `src/content/tuning.ts`):

| Vật thể | Thông số |
| --- | --- |
| `BOMB` | ngòi 2.6s · sát thương 88 · bán kính 150 · tốc độ lăn 150/s · nổ khi cách địch < 34px và lệch làn < 1.2 |
| `FIRE` | sống 7.5s · 29 dps · bán kính 92 · **bỏ qua kẻ bay** |
| `BEE` | máu 30 · tốc độ 230 · 11 sát thương mỗi 0.38s · sống 12s |
| `WALL` | máu 190 · sống 20s · chọn làn đông địch nhất chưa có tường |
| `FAN` | tầm 330 · đẩy bộ 30·(1−d/330+0.35) px/s · đẩy thiết bị 400 px/s · nhịp 1.6s |
| `OIL` | bán kính 100 · làm chậm 0.45 · **cháy 44 dps** · cháy 6.5s · lan sang dầu khác trong 200px |
| `MINE` | sát thương 96 · bán kính 108 · **arm 0.55s** · kích hoạt khi lính bộ < 59.4px |
| `SAW` | tốc độ 185/s · 40 sát thương · mỗi địch trúng **1 lần** · tự huỷ khi x > 1460 |
| `WEB` | sống 8s · bán kính 104 · làm chậm 0.6 · kéo 0.35·dt px về tâm |
| `ICE` | sống 6s · bán kính 104 · đóng băng 0.25s · làm chậm 0.72 · **nổ vào mục tiêu đông cứng ×1.55** |

**Tương tác sinh ra từ tag, không từ vật lý** (`AGENTS.md`):

```
EXPLOSIVE + FLAMMABLE → vụ nổ châm ngòi mọi vũng dầu trong bán kính
PUSH     + PUSHABLE   → quạt đẩy bom đi xa hơn (biến bom thành hệ thống phóng)
BURNING  + FLAMMABLE  → lửa bén sang dầu ở khoảng cách bán kính + 40
ICE (đóng băng)       → mục tiêu đông cứng nhận ×1.55 sát thương nổ
HEAVY (brute/boss)    → nhận ×1.25 sát thương nổ
```

---

## 5. KẺ ĐỊCH (`src/content/enemies.ts`, `src/content/tuning.ts`)

| Loại | Tên VI | Máu | Tốc độ | ST vào LÕI | Cỡ | ST đánh tường | Bay | Tỉ lệ mang chữ | Chữ ưu tiên |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `mote` | Mảnh vụn | 14 | 118 | 4 | 21 | 6 | – | 55% | B O M E |
| `runner` | Kẻ chạy | 18 | 250 | 5 | 23 | 8 | – | 70% | R I F E |
| `flyer` | Kẻ bay | 26 | 190 | 6 | 25 | 9 | ✔ | 100% | I A L N |
| `brute` | Máy ủi | 108 | 76 | 11 | 36 | 20 | – | 100% | W D N S |
| `boss` | Cỗ Máy Câm | 420 | 52 | 22 | 56 | 30 | – | 100% | E O B |

- `boss` nhả thêm **3 × `mote` mỗi 4 giây**.
- **Nhân theo chương** (`chapterScale`): máu ×1.15 mỗi chương, tốc độ ×1.05 mỗi chương
  (chương 1 = hệ số 1; chương 4 = ×1.52 máu, ×1.16 tốc độ).
- **Kẻ bay (flyer)**: bỏ qua tường, và **mọi vùng hiệu ứng mặt đất** (`FIRE`, `OIL`, `WEB`,
  `ICE`, `MINE`, `SAW` đều bỏ qua `flying`). Đây là lý do `BEE` tồn tại.

**Cách phát chữ cho địch** (`assignLetter`) — theo thứ tự ưu tiên:

1. **Danh sách bảo đảm** (`guaranteed` của trận): chữ được phát trước tiên, luôn **công khai**
   (hiện trên đầu địch). Một trận luôn giữ đúng lời hứa về nguyên liệu.
2. **Kẻ chưa rõ** (`unknownCarriers`): số lượng giới hạn mỗi trận, chữ **ẩn** (ô úp) cho tới khi chết.
3. Còn lại: xác suất `carrierChance × 0.5`, chữ ẩn.

---

## 6. LUẬT CHIẾN ĐẤU

### 6.1 Sát thương

**Vụ nổ** (`explode`):

```
sát thương = damage × clamp(1 − (khoảng_cách / bán_kính) × 0.55, 0.45, 1)
           × 1.55 nếu mục tiêu đang đông cứng
           × 1.25 nếu là brute hoặc boss
```
Cộng thêm: đẩy lùi `26 × kick` px (kick = 1.22 nếu có luật `fatBlast`), choáng 0.18s.

Ngòi nổ có **hai đường kích hoạt**: hết ngòi, **hoặc** chạm địch (cách < 34px và lệch làn < 1.2).
Đường thứ hai là thứ làm quả bom "cảm giác như bom" thay vì một hiệu ứng vùng hẹn giờ.

**Sát thương theo thời gian (DoT)** — lửa 29 dps, dầu cháy 44 dps, trạng thái cháy 14.5–17.6 dps.
DoT **không** gây nhấp nháy trắng (xem §16.A1 — đây là bản vá đi kèm tài liệu này).

**Mục tiêu ưu tiên:**
- `BOMB` → `densestEnemy()`: kẻ có nhiều địch khác trong bán kính 140px nhất (bỏ qua kẻ bay).
- `BEE` → kẻ **mang chữ** ở bên trái nhất; hết mục tiêu thì bay về x=330.
- `WALL` → làn đông địch nhất **chưa có tường**.
- `OIL`, `WEB`, `ICE` → `densestEnemy()`.
- `MINE` → `leftmostEnemy()` + 150px.
- `SAW` → bên phải, không ngắm.

### 6.2 Làn và vị trí

- Sân có **5 làn** chiều sâu. Vật thể và địch đều thuộc đúng 1 làn.
- Bom **đổi làn được**: trôi về làn mục tiêu tối đa ±1 làn, tốc độ 1.8 làn/giây.
- Tường chỉ chặn **cùng làn** với địch.
- Vị trí xuất phát: LÕI ở `x = 176`, vật thể mới ở `x = 260`, địch vào ở `x = 1510`.

### 6.3 LÕI và đột nhập (breach)

- LÕI ở `coreEdge() = 210`. Khi địch chạm mốc này: trừ `core` máu của loại đó, **con địch chết**,
  và **nó mang chữ theo xuống mất** (`enemy.carry = null` trước khi chết).
- **Đột nhập tốn cả máu lẫn nguyên liệu.** Đây là lý do LÕI là đồng hồ thật của trận, không
  chỉ là thanh máu.
- Máu LÕI **không hồi giữa trận**, chỉ hồi giữa các trận (§13).

### 6.4 Chốt chống bế tắc (stall guard)

Nếu **hết đợt spawn mà vẫn còn địch sống và không con nào chết** trong `stallSeconds = 8s`:

1. HUD hiện đếm ngược.
2. Hết 8s → **toàn bộ địch còn sống tràn vào LÕI**, mỗi con gây đủ `core` damage của nó.
3. Địch tràn bị tiêu huỷ và **mất luôn chữ**.

Luật này tồn tại để một build phòng thủ thuần (Tường + Quạt) **không thể** kéo dài trận vô hạn.
Bài học thiết kế: **chặn không phải là giết.**

### 6.5 Hiệu ứng trạng thái

| Trạng thái | Nguồn | Tác dụng |
| --- | --- | --- |
| Làm chậm | OIL (0.45), WEB (0.6), ICE (0.72) | nhân tốc độ × (1 − mức chậm) |
| Đóng băng | ICE | dừng hoàn toàn 0.25s, làm mới mỗi khung hình |
| Cháy | FIRE (60%/giây), dầu cháy | 1.4s, 14.5–17.6 dps |
| Choáng | mọi vụ nổ (0.18s), quạt (0.06s) | đứng yên |

---

## 7. CHUỖI — CASCADE

`chainWindow = 2.2s`.

```
Nếu (thời_điểm − lần_ghép_trước ≤ 2.2s) VÀ (chưa sang vòng túi mới):
    chuỗi += 1
Ngược lại:
    chuỗi = 1
```

- Chuỗi **chỉ tăng**, không giảm dần — một lần đứt là về 1.
- `bestChain` lưu chuỗi dài nhất của trận.
- Chuỗi ≥ 2 phát hiệu ứng `×N` trên sân và làm màn hình rung mạnh hơn.
- **Chuỗi bị cắt bởi vòng túi mới** (`cycleSinceCraft`), vì vòng túi là kinh tế chứ không phải chuỗi.

Ý nghĩa thiết kế: chuỗi đo **mật độ giết → rơi chữ → ghép**, tức là đo xem cỗ máy của bạn có
tự nuôi được không. Mục tiêu thiết kế: chuỗi 2 là chuyện thường, 3 là thú vị, 4+ là hiếm.

---

## 8. CHỮ `?` — CAN THIỆP DUY NHẤT

- Công thức được đưa vào danh sách mục tiêu **chỉ khi kho thiếu ĐÚNG MỘT chữ** (`refreshTargets`).
- Bấm `?` → chọn công thức → chữ thiếu được **điền thay**, phần còn lại của recipe bị tiêu thụ
  từ kho → ghép chạy ngay, **không cần chờ túi**.
- Số lượt `?` do **bộ khởi đầu** quyết định: Dây chuyền 1 · Pháo đài 1 · Thợ săn 2.
- Số lượt **nạp lại mỗi trận** (xem §13), cộng thêm 1 nếu có luật `twoCharges`.
- **Chỉ dùng được khi trận đang ở trạng thái `fight`** — bấm trong lúc intro sẽ không có tác dụng.
- Thống kê: `wildcardsSpentEarly` đếm số lượt dùng trong 6 giây đầu trận (đo độ "hoảng").

---

## 9. TÁM TRẬN (`src/content/encounters.ts`)

| # | id | Tên | Loại | Chương | Hệ số máu | Chữ mở màn | Chữ bảo đảm | Kẻ ẩn | Thưởng |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `ch1-ignition` | Mồi lửa | mở màn | 1 | ×1.00 | B O M | B B O M | 2 | túi |
| 2 | `ch1-stream` | Dòng chảy | thường | 1 | ×1.05 | F I | F I R E | 3 | hỗn hợp |
| 3 | `ch1-slick` | Vũng dầu | thường | 1 | ×1.12 | O I | O I L B | 3 | hỗn hợp |
| 4 | `ch2-wing` | Bầy bay | thường | 2 | ×1.18 | B E | B E E L | 4 | công thức |
| 5 | `ch2-bulwark` | Máy ủi | **tinh anh** | 2 | ×1.25 | B B | W A L L B | 4 | luật máy |
| 6 | `ch3-crush` | Nghiền | thường | 3 | ×1.32 | B O | B B O M F | 5 | hỗn hợp |
| 7 | `ch3-heat` | Lò nung | thường | 3 | ×1.40 | O I | O I L F I | 5 | luật máy |
| 8 | `ch4-silencer` | Cỗ Máy Câm | **trùm** | 4 | ×1.50 | B O M | B B O M W | 6 | hỗn hợp |

**Chữ mở màn** đổ thẳng vào kho lúc bắt đầu trận. Đây là "bàn cờ mở" được biên soạn: trận 1
có sẵn `B O M`, và danh sách bảo đảm phát `B` tiếp theo → **recipe `BOMB` hoàn thành trong vài
giây đầu**, dù chữ cuối đến từ túi hay từ xác địch. Người chơi thấy
`chữ → vật thể → giết → chữ` mà không cần được dạy luật nào.

**Nhịp sóng** `at` (giây) còn được nhân nhiễu ±6% (`waveRng.range(0.94, 1.06)`) để chơi lại
không thấy y hệt, nhưng **không đổi thứ người chơi phải tính toán**.

Ba trận có gợi ý dạy học: #1 (`teaches: craft`), #2 (`carrier`), #3 (`wildcard`).

---

## 10. BA BỘ KHỞI ĐẦU (`src/content/kits.ts`)

| Bộ | Tên | Công thức | Túi | Máu LÕI | Lượt `?` |
| --- | --- | --- | --- | --- | --- |
| `assembly` | DÂY CHUYỀN | BOMB · FIRE · OIL | B B O O M M F I R E (10) | 100 | 1 |
| `bastion` | PHÁO ĐÀI | WALL · MINE · BOMB | W A L L B B O M M I N (11) | 120 | 1 |
| `hunter` | THỢ SĂN | BEE · MINE · WEB | B E E M I N E W B E (10) | 90 | 2 |

**Ghi chú thiết kế quan trọng:** túi của Pháo đài **cố ý thiếu một chữ `E`** cho `MINE`
(`M I N` có, thiếu `E`). Khe hở đó chính là chỗ dành cho chữ `?` hoặc cho chữ đầu tiên
nhặt được từ xác địch — người chơi học được cơ chế can thiệp bằng chính nhu cầu của mình.

---

## 11. THƯỞNG GIỮA CÁC TRẬN (`src/run/rewards.ts`)

- Sau mỗi trận thắng: **3 lựa chọn**, chọn 1.
- Bộ sinh nhìn vào túi và các recipe đang trang bị để không đưa ra lựa chọn vô dụng
  (`neededLetters` tìm chữ mà recipe cần nhiều hơn túi cung cấp được).
- **Không có thưởng kiểu "+X% sát thương".** Mọi thưởng thay đổi *hình dạng* của cỗ máy.

| Loại | Hiệu ứng |
| --- | --- |
| `bagAdd` | thêm 1 viên chữ vào túi |
| `bagRemove` | bỏ 1 viên khỏi túi (rút ngắn vòng) |
| `bagDuplicate` | **xem §16.A6 — hiện được cài y hệt `bagAdd`** |
| `repair` | hàn LÕI |
| `rule` | nhận 1 luật máy |
| `tweak` | nhận 1 tinh chỉnh hành vi |
| `blueprint` | đổi 1 công thức đang trang bị |

**Công thức thay vào ô nào?** `leastUsedSlot()` — ô có công thức **ít được ghép nhất tính tới
lúc đó**. Nhờ vậy thưởng công thức là *nâng cấp*, không phải *thay thế*.

---

## 12. LUẬT MÁY (`src/content/rules.ts`)

Luật máy **đổi luật**, không đổi phần trăm. 9 luật + 4 tinh chỉnh:

| id | Tên VI | Hiệu ứng |
| --- | --- | --- |
| `firstVowelDuplicated` | Nguyên âm đầu vòng | nguyên âm đầu tiên rút ra mỗi vòng túi được nhân đôi |
| `lastTileCopied` | Viên cuối vòng | viên cuối cùng của mỗi vòng túi được nhân đôi |
| `consonantInject` | Nhét thêm B | mỗi trận bắt đầu với thêm một chữ `B` trong túi |
| `carrierDupe` | Chữ rơi nhân đôi | chữ đầu tiên mỗi kẻ mang chữ để lại được nhân đôi |
| `firstKillTriple` | Mồi đầu trận | chữ của kẻ chết đầu tiên trong trận rơi ra gấp ba |
| `firstCraftRefund` | Chế đầu miễn phí | lần ghép đầu tiên mỗi trận hoàn lại toàn bộ chữ đã dùng |
| `bombRefund` | Bom hoàn B | mỗi 3 lần chế Bom, hoàn lại 1 chữ `B` |
| `unspentWildcard` | ? để dành | lượt `?` không dùng chuyển thành 1 nguyên âm trong túi sau trận |
| `startWithTwo` | Mở màn có sẵn | đầu mỗi trận, kho có sẵn 2 viên ngẫu nhiên |

**Tinh chỉnh (`RULE_TWEAKS`):**

| id | Tên VI | Hệ số | Ý nghĩa |
| --- | --- | --- | --- |
| `shortFuse` | Ngòi ngắn | ×0.55 ngòi, ×1.15 bán kính | nổ sớm hơn nhưng rộng hơn |
| `longBurn` | Lửa dai | ×1.45 thời lượng | lửa và dầu cháy lâu hơn |
| `fatBlast` | Nổ rộng | ×1.22 bán kính + đẩy lùi | mọi vụ nổ rộng hơn |
| `twoCharges` | Hai lượt ? | +1 | thêm 1 lượt `?` mỗi trận |

---

## 13. CẤU TRÚC VÁN & THẮNG/THUA (`src/run/run.ts`)

- Ván = **8 trận liên tiếp**. Thắng trận 8 → `completed`.
- **Máu LÕI mang sang trận sau.** Sau mỗi trận thắng, hồi `round(maxCoreHp × 0.24)`.
  Với LÕI 100 → hồi 24 máu/trận.
- Thua khi máu LÕI ≤ 0 → `failed`, kết thúc ván ngay.
- **Lượt `?` được nạp lại mỗi trận**: `kit.wildcards + (có luật twoCharges ? 1 : 0)`.
  Lưu ý: nhận thưởng cũng reset về mức này.
- Điểm cuối ván dựa trên `record`: số lần ghép, số mạng, chuỗi dài nhất, giây tới chữ đầu,
  số chữ nhặt được, số lượt `?`, số trận đã qua.

---

## 14. HUD TRONG TRẬN

Thứ tự ưu tiên thông tin do `AGENTS.md` chốt: **(1) tiến độ công thức → (2) kho chữ →
(3) lượt `?` → (4) chữ sắp tới → (5) máu LÕI → (6) độ sâu chuỗi.** Không gì khác được lên sân.

| Vùng | Nội dung |
| --- | --- |
| Dải trên trái | tên trận + loại (MỞ MÀN/THƯỜNG/TINH ANH/TRÙM) + `ĐỢT n/8` + `CÒN LẠI n` |
| Ô CHUỖI | `CHUỖI ×N`, sáng viền khi chuỗi còn sống |
| Nút điều khiển | `1×` tốc độ · `?` mở CÁCH CHƠI · `II` tạm dừng |
| Dòng gợi ý | một câu, tự biến mất; **khoanh vàng vào đúng bảng nó đang nói tới** |
| 3 thẻ công thức | ô chữ theo thứ tự đánh vần, ô rỗng = chữ còn thiếu, `thiếu B ×2` |
| CHỮ SẼ RƠI | chữ đã công khai trên đầu địch + số kẻ chưa rõ chữ |
| TÚI CHỮ | `Vòng n` + thanh còn lại; **nháy vàng khi sang vòng mới** |
| KHO CHỮ | chữ đang có, gộp theo chữ cái |
| Ô `?` | số lượt còn lại + công thức sắp điền được |
| Trên LÕI | thanh máu + cảnh báo đỏ khi < 34% |

Nhấn vào thẻ công thức → mở bảng tra: từ này làm gì, còn thiếu chữ gì.

---

## 15. SỐ LIỆU CÂN BẰNG (đo được, không phải cảm nhận)

Chạy `node tools/shoot.mjs sim --runs=12 --kit=<bộ>`. Bot chơi **cố tình ngây thơ** (luôn lấy
lựa chọn thưởng đầu tiên) nên các số này là **sàn**, không phải trần.

| Chỉ số | Mục tiêu | `assembly` | `bastion` | `hunter` |
| --- | --- | --- | --- | --- |
| Trận qua được (tb/8) | 8 | 6.75 | 5.00 | 5.50 |
| Giây tới chữ đầu | 2–4s | 3.73 | 4.60 | **2.99** |
| Thời lượng mỗi trận | 8–15s | **16.36** | **16.54** | **16.43** |
| Chuỗi dài nhất (tb) | 2–4 | 2.92 | 2.74 | 3.18 |
| Lần ghép mỗi trận | – | 6.87 | 5.98 | 8.03 |
| Trận thắng sát nhất (máu LÕI còn) | – | 18.5% | 12.3% | 24.7% |
| **Ván hoàn thành / 12 lượt** | – | **1** | **0** | **0** |

**Hai kết luận đọc được từ bảng này:**

1. **Trận đấu dài hơn mục tiêu thiết kế** (16.4s so với 8–15s) ở cả ba bộ. Lệch khoảng 9–25%.
2. **Rất khó hoàn thành ván**: 1/36 lượt chạy hoàn thành được cả 8 trận, với người chơi ngây thơ.
   Máu LÕI còn lại khi thắng trận trung bình chỉ 12–25%.

Phân bố ghép theo công thức cũng cho thấy 4 từ "mỏng" hầu như không xuất hiện:
`SAW` 1 lần, `MINE` 4, `FAN` 7, `ICE` 12 trên 12 ván.

---

## 16. SAI LỆCH ĐÃ TÌM THẤY

> Mục này là lý do chính tài liệu này tồn tại. Chia làm 3 nhóm: **đã sửa** / **chưa sửa**
> / **nợ kỹ thuật**. Mỗi mục ghi rõ `file:line` để đối chiếu.

### A. Lỗi đã xác nhận và đã sửa

**A1. ĐỊCH ĐỨNG TRONG LỬA BỊ VẼ THÀNH MÀU TRẮNG — đã sửa.**
`damageEnemy` cộng `+0.25` vào `hitFlash` **mỗi lần gọi hàm**, kể cả các tick sát thương-theo-giây
(gọi mỗi khung hình ở 120fps). Vì `hitFlash` chỉ giảm 3/giây, nó **bão hoà ở 1.0 vĩnh viễn**, và
renderer vẽ màu trắng khi `hitFlash > 0.4` → mọi đơn vị đứng trong lửa/dầu cháy thành **cục trắng
đặc**, che luôn hiệu ứng cháy của chính nó.

*Bằng chứng đo được (trước khi sửa):* 18/18 mẫu địch đang cháy có `hitFlash > 0.4` (**100%**).
*Sau khi sửa:* 0/8313 mẫu (**0%**). DoT giờ gọi `damageEnemy(..., { pulse: false })`.

**A2. CÔNG CỤ ĐO NHỊP ĐỘ CHIA SAI SỐ — đã sửa.**
`tools/harness.ts` báo "encounter seconds" bằng cách chia tổng thời gian cho **7**, trong khi ván
có **8** trận và phần lớn lượt chạy kết thúc sớm (thường 5–7 trận). Số báo cáo bị thổi lên
~14%. Đã sửa thành chia theo **số trận thực tế đã đánh**. Số đúng: **16.36s** (không phải 17.16s).

**A3. LUẬT "MỒI ĐẦU TRẬN" MẠNH GẤP 5 LẦN MÔ TẢ — đã sửa.**
Đây là lỗi nặng nhất tìm được, vì nó **âm thầm đổi cân bằng mà người chơi không biết**.

Mô tả hiển thị trong game:
> VI: *"Chữ của kẻ chết đầu tiên trong trận rơi ra gấp ba."*
> EN: *"The first kill of each encounter drops triple letters."*

Nhưng phần cài đặt **không có điều kiện nào** kiểm tra "đầu tiên":

```ts
onKill: (e) => {
  if (!e.carrier || e.letters.length === 0) return;
  e.duplicate(e.letters[0]);   // chạy trên MỌI mạng giết được
  e.duplicate(e.letters[0]);
},
```

Tệ hơn: API hook không hề cung cấp chỉ số mạng giết —
`KillHookEvent` chỉ có `{ carrier, letters, duplicate }` — nên luật này **không thể** được cài
đúng như mô tả. Nó biến "một lần gấp ba mỗi trận" thành "mọi mạng mang chữ đều gấp ba".

*Đo được:* trung bình **10.3 mạng mang chữ mỗi trận** → luật cũ nhân đôi ~10 chữ/trận.
Sau khi sửa: **đúng 2 chữ** (một lần gấp ba). Tức là mạnh hơn mô tả **~5 lần**.

*Cách sửa:* thêm `killIndex` (1-based) vào `KillHookEvent`, `Battle.fireKillHooks` truyền
`this.killsThisEncounter`, và luật chặn bằng `if (e.killIndex !== 1) return;`.

> **Đây là loại lỗi bạn nên bảo trợ lý soi kỹ nhất:** mô tả tiếng Việt và tiếng Anh khớp nhau,
> nhưng cả hai đều không khớp code. Sáu luật máy còn lại đã được đối chiếu và **khớp** mô tả.

### B. Chưa sửa — cần bạn quyết

**B1. Cấu hình chết (khai báo nhưng không ai đọc).** Sáu mục trong `src/content/tuning.ts`
không được mô phỏng dùng tới. Nguy hiểm vì người chỉnh balance sẽ tưởng chúng có tác dụng:

| Hằng số | Giá trị | Thực tế mô phỏng dùng |
| --- | --- | --- |
| `TUNE.encounterTarget` | `{12,16,24,40}` | **không dùng gì** — và mâu thuẫn với mục tiêu 8–15s trong `AGENTS.md` |
| `TUNE.wildcardCharges` | `1` | số lượt lấy từ `kit.wildcards` (1/1/2) |
| `TUNE.bomb.knockback` | `46` | hardcode `26 * kick` tại `battle.ts:744` |
| `TUNE.wall.cooldown` | `1.1` | hardcode `0.7` tại `battle.ts:926` |
| `TUNE.juice.shakeMax` | `9` | không dùng; `fx.ts` tự giới hạn |
| `TUNE.juice.flashMax` | `0.35` | không dùng |

**B2. Hằng số "5 làn" bị lặp 4 lần.** `TUNE.lanes: 5`, `FIELD.lanes: 5`, và hardcode `% 5`
hai lần (`battle.ts:425` và `battle.ts:951`). Sửa một chỗ là vỡ lặng lẽ ở ba chỗ còn lại.

**B3. Toạ độ bị hardcode trong mô phỏng.** `FIELD.spawnX = 1520` khai báo nhưng không dùng;
mô phỏng hardcode `x: 1510` (`battle.ts:440`). `coreEdge()` trả về đúng số `210` (`battle.ts:959`)
thay vì suy ra từ `FIELD`.

**B4. Toán học bố cục rò rỉ vào mô phỏng.** `stepBee` tính `dy = 300 + lane × TUNE.enemies.mote.size × 1.4`
(`battle.ts:787`) — tức là mô phỏng đang giả định kích thước pixel của sân để biết con ong bay cao bao nhiêu.
Cỡ chữ `mote.size` là số liệu va chạm, không phải toạ độ màn hình.

**B5. Địch hộ tống của trùm bỏ qua hệ số chương.** `stepSpawner` nhân máu/tốc độ với
`chapterScale`, nhưng nhánh spawn hộ tống (`battle.ts:951`) chỉ dùng `hpMul`/`speedMul` thô.
Ở chương 4, hộ tống lẽ ra phải ×1.52 máu — thực tế chỉ ×1.5.

**B6. `bagDuplicate` và `bagAdd` là cùng một đoạn code.** Trong `Run.applyReward`, cả hai
`case` đều chỉ làm `st.bag.push(reward.letter)`. Hai loại thưởng khác tên, khác mô tả hiển thị
("NHÂN ĐÔI L" / "THÊM CHỮ I") nhưng **cùng một hiệu ứng**. Hoặc là trùng lặp ngoài ý muốn,
hoặc là thiếu logic.

**B7. Mô tả `MINE` nói quá.** Chuỗi mô tả ghi *"Có gì chạm vào là nổ"*, nhưng `stepMine` chỉ
kích hoạt với **lính bộ** (bỏ qua `flying`) và bán kính kích hoạt thật là `radius × 0.55 = 59.4px`.
Kẻ bay bay qua mìn an toàn.

**B8. Nút `?` bấm được trong lúc intro nhưng không có tác dụng.** `useWildcard` chặn bằng
`state !== 'fight'`, nhưng HUD vẫn vẽ nút như bình thường ở giai đoạn intro.

**B9. `CÒN LẠI n` đếm số địch đang sống, không phải số địch còn lại của trận.**
`encounterStrip` lấy `enemies.filter(e => !e.dead).length`. Vì spawn diễn ra theo đợt, con số này
có thể **tăng lên**. Nhãn "CÒN LẠI" gợi ý nghĩa khác với thứ nó đo.

### C. Nợ kỹ thuật / mâu thuẫn tài liệu

**C1. `docs/UX_UI.md` ghi "Authored at 1920×1080"** nhưng `VIEW` trong `src/core/theme.ts` là
**1440×810**. Tài liệu sai.

**C2. `TUNE.encounterTarget` mâu thuẫn với `AGENTS.md`** (12/16/24/40 so với 8–15s) — và cả hai
đều không khớp thực tế đo được (16.4s).

**C3. Hai công thức gần như vô hình.** `SAW` và `ICE` chỉ vào được qua thưởng, và trong
36 ván mô phỏng (12 × 3 bộ) chúng chỉ được ghép **1 lần** (`SAW`) và **16 lần** (`ICE`).
`SAW` đặc biệt tệ: 1 lần trên 36 ván. Ngược lại, các từ mà bộ khởi đầu có sẵn thì hoạt động tốt
(`BEE` 311 lần, `BOMB` 199–335 lần). Vấn đề nằm ở chỗ **thưởng công thức không đủ sức thuyết phục
để người chơi đổi một từ đang chạy tốt lấy một từ lạ**.

**C4. Hộ tống của trùm theo nhịp cố định 4s**, không có pha áp lực được biên soạn như các trận khác.

---

## 17. CÁCH TỰ KIỂM CHỨNG

```bash
npm install
npm run typecheck                         # phải sạch
npm run build                             # phải chạy được
npm test                                  # 17 test miền (kinh tế chữ, kit, tính tất định)
node tools/shoot.mjs sim --runs=12 --kit=assembly   # bảng số liệu §15
node tools/shoot.mjs shot battle out.png --seconds=9 --kit=assembly --seed=7
```

**Quy tắc của repo:** việc hình ảnh chỉ được coi là xong khi **đã nhìn tận mắt một file PNG**
(`tools/shoot.mjs` render code game thật trên canvas của Node). Mọi tuyên bố về cân bằng phải
kèm số từ `sim`, không kèm cảm nhận.

---

## 18. NHỮNG THỨ CỐ TÌNH KHÔNG CÓ

Đã cân nhắc và **loại bỏ** (chi tiết ở `docs/DECISIONS.md`):

- Bản đồ phân nhánh, tiền tệ meta, nhiều kỹ năng chủ động, nâng cấp kiểu lạm phát chỉ số,
  chuỗi proc ẩn, dịch vụ online, tài khoản, mạng.
- **Không gõ chữ tự do.** Từ vựng là các công thức được biên soạn.
- **Không có công thức nào dịch sang tiếng khác.** `BOMB` vẫn là `BOMB` trong mọi ngôn ngữ —
  recipe là token gameplay, không phải văn xuôi. Chỉ phần giải thích bên cạnh được dịch.
