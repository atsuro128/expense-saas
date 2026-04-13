// レイアウトルート用の AppLayout + Outlet ラッパーコンポーネント。
// App.tsx でレイアウトルート方式（<Route element={<AppLayoutOutlet />}>）を実現するために使用する。
// 各ページコンポーネントは AppLayout を自前でラップせず、このラッパーによって統一的にレイアウトが適用される。

import { Outlet } from 'react-router-dom';
import AppLayout from './AppLayout';

/**
 * AppLayoutOutlet は React Router のレイアウトルートとして機能するコンポーネント。
 * AppLayout 内に <Outlet /> を配置することで、配下の子ルートが AppLayout 内に描画される。
 */
export default function AppLayoutOutlet() {
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
