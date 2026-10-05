# CADStudio 3D Viewer (v2.1.0)

<p align="center">
  <img src="public/favicon.svg" alt="CADStudio 3D Logo" width="96" height="96" />
</p>

<p align="center">
  <strong>ブラウザ上で高速・高精度に動作する次世代 3D CAD & メッシュビューアー</strong><br>
  GLB / STEP / STL / 3MF / OBJ / ZIP に完全対応。高精度自動フィット、中心軸回転、断面切断、寸法計測、物性・重量試算を搭載。
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-v2.1.0-blue.svg" alt="Version">
  <img src="https://img.shields.io/badge/React-19-61dafb.svg?logo=react" alt="React 19">
  <img src="https://img.shields.io/badge/Three.js-r174-black.svg?logo=three.js" alt="Three.js">
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178c6.svg?logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/TailwindCSS-v4-38bdf8.svg?logo=tailwindcss" alt="Tailwind CSS">
  <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License">
</p>

---

## 🌟 主な特徴 (Features)

### 1. 多様な CAD & 3D メッシュフォーマットに対応
- **GLB / glTF**: Google Draco 圧縮 (`KHR_draco_mesh_compression`) および Meshopt 圧縮 (`EXT_meshopt_compression`) に完全対応。
- **STEP / STP (ISO 10303)**: OpenCASCADE WebAssembly エンジンによる高精度 CAD ソリッド解析。
- **STL**: 3D プリント用バイナリ・ASCII メッシュ。
- **3MF**: 竹製 3D プリンタ等のマルチカラー・マルチボディ 3D Manufacturing Format。
- **OBJ / MTL**: 標準 Wavefront 3D オブジェクト。
- **ZIP アーカイブ**: 複数の CAD ファイルをまとめた ZIP をドラッグ＆ドロップで一括展開・プレビュー。

### 2. インテリジェントな視野角フィット (Auto-Fit Camera)
- モデルのバウンディングスフィア半径とカメラ画角（垂直・水平 FOV）から、理想的なカメラ距離を幾何学的に正確に算出。
- **0.01mm の精密部品から 10,000mm の大型機械まで、読み込み直後に画面中央へ最適な大きさ（画面の約 80%）でスムーズに自動フィット**します。

### 3. 精密な回転軸・ピボット制御
- **幾何中心への完全正規化**: 偏った座標系を持つモデルでも、読み込み時に重心を中心軸 $(0, 0, 0)$ に自動配置。自転時にもブレません。
- **ダブルクリック・ピボット指定 (Orbit-Around-Point)**: モデル表面の任意の位置を**ダブルクリック**すると、その接触点が新しいカメラ回転軸になり、微細な箇所の観察がスムーズに行えます。
- **ワンクリック中心復帰**: ツールバーの「中心軸へ復帰」ボタンでいつでもモデル全体中心に戻せます。

### 4. XYZ 外形寸法 HUD ＆ 3D 寸法ボックス
- **外形サイズ HUD**: 画面左上に各軸のカラー（X: 赤、Y: 緑、Z: 青）で外形寸法を常時ミリメートル表示。
- **3D 寸法ガイドフレーム**: モデルの周りに外接直方体ワイヤーフレームと各辺の寸法ガイド線を立体表示（ON/OFF 切替可）。

### 5. 360° ターンテーブル自動回転 ＆ 超軽量動画エクスポート (MP4)
- **中心軸自動回転**: ワンクリックで幾何中心を軸としたスムーズな自転（0.5x 低速 / 1.0x 標準 / 2.0x 高速）が可能。
- **360° ターンテーブル動画収録 (MP4)**: モデルが正確に 360 度（1 回転）自転する様子を 60fps で自動録画し、**GIF 比で約 90% 軽量（約 1〜2MB）な高画質 MP4 動画**としてワンクリックで書き出し・保存。
- 完成した動画はブラウザ上で即座にループプレビュー確認・ダウンロードが可能。

### 6. 3D形式の相互変換・エクスポート (3D Format Converter)
- **非圧縮 標準 GLB (Binary glTF)** 【★フルカラー対応】:
  - Draco などの特殊デコーダーが不要な、最も互換性の高い標準 GLB へワンクリック変換。**パーツカラー、金属質感、PBRプロパティを100%完全保持**。自作の HTML 単体アプリや古いブラウザ、Windows 3D ビューアー、PowerPoint 等で圧縮 GLB が開けない問題を瞬時に解決します。
- **自己完結型 HTML 3D ビューアー (.html)** 【★フルカラー対応】:
  - 3D モデルデータ（Base64）と Three.js ビューアーを 1 枚の HTML に完全内蔵。
  - PC やスマホにダウンロードしてダブルクリックするだけで、**インターネット不要・完全オフラインで誰でもカラー 3D 閲覧・自動回転・ズーム・ワイヤーフレーム切替**ができます（配布や共有に最適）。
- **Wavefront OBJ + MTL (ZIP)** 【★フルカラー対応】:
  - 色情報定義ファイル（.mtl）と OBJ メッシュを同梱した ZIP アーカイブ。Blender や Maya、Windows 3D ビューアーで色付きのまま開けます。
- **カラー PLY 形式 (.ply)** 【★フルカラー対応】:
  - 各頂点に RGB カラーが直接埋め込まれた Polygon File Format。点群・解析・カラー 3D プリント用。
- **パーツ別 STL 一括出力 (ZIP)** 【パーツ別色分け対応】:
  - アセンブリのパーツごとに個別の STL ファイルを生成してまとめた ZIP。スライサー（Bambu Studio, Prusa, Cura等）でパーツごとに色や材料を割り当ててマルチカラー造形が可能。
- **STL 形式 (単一メッシュ)** 【単色】:
  - 単色の 3D 造形・CAM 切削用（STL 規格の仕様上カラー情報は含みません）。
- **パーツ個別エクスポート / 非表示パーツ除外** オプション完備。

### 7. 高精度 2 点間距離計測 (Measurement Tool)
- モデル表面の 2 点をクリックするだけで、直線距離 (mm) および各軸成分 ($\Delta X, \Delta Y, \Delta Z$) を 3D 空間上にピン表示。
- モデルサイズに合わせてピン球の大きさが自動スケーリング。わかりやすいガイダンス HUD 付き。

### 7. 精密な断面クリッピング ＆ アセンブリ分解
- **断面切断 (Section Clipping)**: X / Y / Z 軸スライダーでモデル内部構造をスライス表示。切断方向のワンクリック反転にも対応。
- **分解ビュー (Explode)**: 複数パーツで構成されるアセンブリをスライダー (0%〜200%) で滑らかに展開。

### 8. 物性計算・材料密度・重量試算 (Inspector Panel)
- 各パーツの体積 ($\text{cm}^3$)、ポリゴン数、頂点数を自動算出。
- PLA、ABS、PETG、ナイロン、アルミニウム、ステンレス鋼、チタン合金、真鍮、CFRP などの材料密度プリセットから、**推定重量 (g) と材料コスト (円)** を自動算出。
- 個別パーツの表示/非表示、カラー変更、パーツ個別削除 ＆ Undo (元に戻す) に対応。

### 9. その他の便利機能
- **2 ファイル重ね合わせ比較**: 別のバージョンや設計変更前後の CAD ファイルを半透明ブルーで重ねて形状の差異を視覚的に比較。
- **3D オリエンテーションギズモ**: 右上のギズモをクリックして等角 (ISO)、正面、背面、上面、底面、右面、左面にワンクリック切り替え。
- **マテリアル質感プリセット**: 標準 CAD PBR、マットクレイ、金属メタリック、半透明ガラス、法線マップ (Normal)。
- **表示スタイル**: ソリッド、ワイヤーフレーム、ソリッド+ワイヤー、半透明 X 線 (Ghost)。
- **高解像度スクリーンショット撮影** ＆ **没入フルスクリーン表示**:
  - 全画面表示中は、マウス操作が約 2.5 秒間途絶えると**マウスカーソルおよび画面上の全ボタン・UI（ツールバー、ギズモ、HUD 等）が自動でフェードアウトして非表示**になり、美しいショールーム・展示モードになります。
  - マウスを動かすかキー・タッチ操作を行うと、即座にすべての操作ボタンとカーソルが滑らかに再出現します。
- **ビルトイン CAD サンプル**: 平歯車機構、ボールベアリング機構、L字マウントブラケットをワンクリックで読み込み可能。

---

## 🎮 操作方法 (Controls)

| 操作 | アクション |
| :--- | :--- |
| **左ドラッグ** | モデルの 3D 回転 (軌道回転) |
| **右ドラッグ / 中ドラッグ** | カメラの平行移動 (パン) |
| **マウスホイール / ピンチ** | スムーズズームイン / ズームアウト |
| **モデル上をダブルクリック** | クリックした位置を新しい回転軸 (ピボット) に設定 |
| **計測ツール ON 時のクリック** | 1 点目・2 点目を指定して距離 (mm) を計測 |
| **F キー / 全画面ボタン** | 没入フルスクリーン（画面100%モデル表示）の切り替え |
| **Esc キー** | フルスクリーン表示の終了 |

---

## 💻 動作環境・開発環境のセットアップ

### 前提条件
- Node.js 18.0 以上
- npm, pnpm, yarn, または bun

### インストール手順

```bash
# 1. リポジトリのクローン
git clone https://github.com/your-username/cad-viewer-3d.git
cd cad-viewer-3d

# 2. 依存パッケージのインストール
npm install

# 3. 開発サーバーの起動
npm run dev
```

起動後、ブラウザで `http://localhost:3000` を開くとローカル環境で CAD ビューアーが動作します。

### 本番ビルド (Build)

```bash
# TypeScript 型チェック & 本番用バンドル生成
npm run build

# ビルド成果物のローカルプレビュー
npm run preview
```

ビルドが完了すると、`dist` ディレクトリに最適化された静的ファイル一式が出力されます。

---

## 🚀 デプロイ方法

### GitHub Pages での公開
1. リポジトリの **Settings** > **Pages** に移動します。
2. **Build and deployment** > **Source** で **GitHub Actions** を選択します。
3. 推奨される Vite ワークフローを選択してコミットすると、自動的にビルド＆公開されます。

### Vercel / Cloudflare Pages での公開
- Framework Preset に `Vite` を選択するだけで、設定不要で 1 分で全世界へ CDN 配布されます。

---

## 🛠️ 技術スタック (Tech Stack)

- **Frontend Core**: React 19, TypeScript
- **3D Graphics Engine**: Three.js (r174)
- **CAD Parsers**:
  - `GLTFLoader` (with Google DracoLoader & MeshoptDecoder)
  - `STLLoader`
  - `occt-import-js` (OpenCASCADE WebAssembly for STEP)
  - `fflate` (High-speed zip extraction for 3MF)
- **Icons**: Lucide React
- **Styling**: Tailwind CSS v4

---

## 📄 ライセンス (License)

本プロジェクトは [MIT License](LICENSE) のもとで公開されています。商用・非商用問わず自由にご利用いただけます。
