# LONG GIA HUY CLOUD PHONE — triển khai Android đám mây thật

## Trạng thái hiện tại

Website hiện tại là cổng giao diện tĩnh. Các nút YouTube/TikTok/Chrome mở dịch vụ bên ngoài; chưa có Android VM, chưa có truyền hình ảnh/điều khiển cảm ứng từ xa, chưa có đăng nhập hay thanh toán thật.

## Mục tiêu sản phẩm

- Mỗi người thuê có một Android VM riêng chạy trên hạ tầng đám mây.
- Người dùng điều khiển VM qua trình duyệt điện thoại bằng luồng hình ảnh + sự kiện chạm/bàn phím (WebRTC hoặc giao thức remote-display tương đương).
- TikTok, YouTube, Chrome, Google Play và ứng dụng Android khác được cài/chạy bên trong VM, không chạy trên điện thoại điều khiển.
- Gói thuê: 1, 2, 3, 7 hoặc 30 ngày.
- Tài khoản admin được miễn phí theo quyền được xác minh ở backend.
- Hết hạn thuê: backend khóa phiên, lưu/xử lý dữ liệu theo chính sách đã công bố rồi dừng/thu hồi VM.

## Kiến trúc cần có

1. **Web frontend**: đăng nhập, trang thiết bị, màn hình stream, điều khiển cảm ứng, trạng thái máy, thời hạn thuê.
2. **Backend API**: xác thực, phân quyền, quản lý gói thuê, cấp phát/thu hồi VM, kiểm tra thời hạn, nhật ký hoạt động.
3. **Database**: users, roles, plans, subscriptions, devices, provider instance IDs, audit logs.
4. **Android cloud provider**: Android VM có quyền hiển thị/điều khiển từ xa và ổ đĩa dữ liệu bền vững.
5. **Payment provider**: chỉ kích hoạt gia hạn sau khi webhook thanh toán được xác minh ở server.
6. **Secrets**: token nhà cung cấp, khóa ký phiên và thông tin thanh toán chỉ nằm trong biến môi trường của backend; tuyệt đối không đưa vào HTML/JavaScript công khai.

## Lưu ý lựa chọn hạ tầng

- Genymotion SaaS có API quản lý máy ảo, nhưng bảng giá công bố Pay-As-You-Go là 0,06 USD/phút cho mỗi thiết bị đang chạy. Tài liệu API hiện mô tả disposable instances; khi dừng, instance bị hủy và dữ liệu thay đổi trong phiên sẽ mất. Không nên chọn làm nền tảng thuê dài ngày nếu chưa có thỏa thuận lưu trữ phù hợp.
- Genymotion PaaS hỗ trợ triển khai trên AWS, Google Cloud, Alibaba Cloud và Azure, có hướng dẫn chọn cấu hình theo nhu cầu stream video/game. Cần xác nhận giá, cách nhúng màn hình vào website và khả năng giữ dữ liệu trước khi mua.
- Anbox Cloud không kèm Google Mobile Services (GMS); ứng dụng phụ thuộc GMS có thể không chạy nếu không có thỏa thuận cấp phép riêng.
- Không được hứa rằng Google Play/TikTok hoạt động đầy đủ trước khi kiểm tra image Android, GMS/Play certification, chính sách của ứng dụng và thiết bị thực tế.

## Quy tắc gói thuê và admin

- Thời lượng gói được tính bằng thời điểm hết hạn UTC lưu ở server, không dùng đồng hồ trình duyệt.
- Backend phải xác minh subscription còn hạn trước khi cấp URL/credential truy cập stream.
- Admin miễn phí bằng danh sách định danh admin được cấu hình ở server (ví dụ ADMIN_USER_IDS), không dựa vào nút ẩn hay localStorage.
- Người dùng không thể tự sửa role, thời hạn, provider instance ID hoặc trạng thái thanh toán qua frontend.
- Khi hết hạn, backend chặn stream trước, sau đó thực hiện chính sách lưu trữ/xóa dữ liệu đã công bố.

## Điều kiện cần trước khi bật máy ảo thật

1. Chọn nhà cung cấp Android cloud và gói/giới hạn chi phí.
2. Chủ tài khoản tạo tài khoản nhà cung cấp và cấp API token theo cách an toàn (secret manager / environment variables).
3. Xác minh image Android có GMS/Google Play hợp lệ nếu sản phẩm cần Play Store.
4. Chọn backend hosting + database + domain HTTPS.
5. Chọn cổng thanh toán và phương thức xác nhận gia hạn.
6. Chạy thử một VM, kiểm tra cài/mở TikTok, YouTube, Chrome, Play Store và stream/điều khiển trên Android thật trước khi mở cho người thuê.

## Không được làm

- Không hiển thị liên kết web YouTube/TikTok như thể đó là ứng dụng chạy trong VM.
- Không giả lập trạng thái “đang chạy” khi chưa có instance thật.
- Không để provider API token trong frontend.
- Không tự động phát sinh chi phí cloud khi chưa được chủ tài khoản chấp thuận.
