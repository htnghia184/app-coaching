# E-Master Personal Coaching (learn.e-master.vn) — Vertical Slice 01

Ứng dụng frontend **guided self-study** có huấn luyện viên (coach) đồng hành: học viên nhận
lộ trình theo tuần, nộp bài (text / audio / file / check-off), coach chấm và yêu cầu làm lại.

- **Stack:** Vite + React 19 + TypeScript + Tailwind CSS 3 + `@supabase/supabase-js` + `react-router-dom` + `lucide-react`
- **Backend:** dùng chung Supabase production với `test.e-master.vn` (Migration `018` v2.2).
  Repo này **không** tạo migration, **không** sửa backend.
- **Không** dùng service-role key ở client. Mọi truy vấn chạy dưới session người dùng → RLS thực thi.

## Yêu cầu môi trường

- Node.js ≥ 20 (đã kiểm thử với Node 24)
- npm ≥ 10

## Cài đặt & chạy cục bộ

```bash
npm install
cp .env.example .env   # Windows: copy .env.example .env
npm run dev
```

Mở http://localhost:5174 (cổng 5174 để không trùng app thi thử ở 5173).

### Biến môi trường (public)

Điền vào `.env` (lấy từ Supabase Dashboard → Project Settings → API):

```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-or-anon-key>
# hoặc VITE_SUPABASE_ANON_KEY=<anon-key>
```

> Không có self-registration. Tài khoản do quản trị viên tạo; `profiles.role` quyết định
> quyền truy cập (`student` / `teacher` / `admin`).

## Scripts

```bash
npm run dev        # dev server (cổng 5174)
npm run typecheck  # kiểm tra TypeScript
npm run build      # typecheck + build production (dist/)
npm run preview    # xem thử bản build
```

## Routes

| Route | Vai trò | Mô tả |
| --- | --- | --- |
| `/login` | công khai | Đăng nhập email/mật khẩu |
| `/` | mọi vai trò | Tự điều hướng theo vai trò |
| `/student` | student | Mục tiêu + tuần hiện tại + danh sách task |
| `/student/tasks/:taskId` | student | Làm bài & nộp |
| `/coach` | teacher (coach) | Danh sách học viên được phân công |
| `/coach/workspace/:enrollmentId` | teacher (coach) | Tạo weekly plan/task, chấm bài, yêu cầu làm lại |
| `/admin` | admin | Thiết lập Coaching enrollment |

## Kiến trúc ngắn gọn

```
src/
  lib/
    supabaseClient.ts   # Supabase client (public key từ .env)
    types.ts            # domain types bám Migration 018
    coachingService.ts  # service layer: MỌI truy cập Supabase đi qua đây
    format.ts
  auth/AuthProvider.tsx # session + profile + role
  components/           # layout, guards, badge, attachment
  pages/                # màn hình student / coach / admin
```

- Cập nhật submission của học viên **bắt buộc** qua RPC `update_own_coaching_submission`.
- Coach chấm bài **bắt buộc** qua RPC `review_coaching_submission`.
- File lưu ở bucket **private** `coaching-submissions`, path `{student_uuid}/{task_uuid}/{file}`;
  đọc bằng **signed URL** có thời hạn (không lưu URL vào DB).

## Ghi chú đã biết

- RLS bảng `profiles` hiện chưa cho coach đọc profile học viên được assign (và học viên đọc
  profile coach). Vì vậy tên học viên/coach có thể không hiển thị; UI hiển thị nhãn dự phòng
  thay vì bịa dữ liệu. Cần bổ sung policy ở tầng DB (do quản trị viên xử lý) để hiển thị đầy đủ.
