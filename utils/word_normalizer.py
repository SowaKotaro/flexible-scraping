"""
表記揺れ単語の名寄せプログラム（グラフ理論マージ方式）
"""

from collections import Counter
from pathlib import Path

import Levenshtein
import jellyfish
import networkx as nx
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# しきい値設定（調整可能）
LEVENSHTEIN_THRESHOLD = 0.7  # 正規化スコア（0-1）
JARO_WINKLER_THRESHOLD = 0.7  # スコア（0-1）
NGRAM_COSINE_THRESHOLD = 0.7  # コサイン類似度（0-1）
NGRAM_SIZE = 2  # Bi-gram


def load_words(input_path: str) -> list[str]:
    """入力ファイルから単語リストを読み込む"""
    with open(input_path, "r", encoding="utf-8") as f:
        words = [line.strip() for line in f if line.strip()]
    return words


def get_unique_words_with_frequency(words: list[str]) -> tuple[list[str], Counter]:
    """重複を排除しつつ出現頻度を記録"""
    frequency = Counter(words)
    unique_words = list(dict.fromkeys(words))  # 順序を保持
    return unique_words, frequency


def normalized_levenshtein(s1: str, s2: str) -> float:
    """正規化レーベンシュタイン類似度（0-1）"""
    if not s1 and not s2:
        return 1.0
    max_len = max(len(s1), len(s2))
    if max_len == 0:
        return 1.0
    distance = Levenshtein.distance(s1, s2)
    return 1.0 - (distance / max_len)


def jaro_winkler_similarity(s1: str, s2: str) -> float:
    """ジャロ・ウィンクラー類似度"""
    return jellyfish.jaro_winkler_similarity(s1, s2)


def ngram_tokenizer(text: str, n: int = NGRAM_SIZE) -> list[str]:
    """N-gramトークナイザー"""
    if len(text) < n:
        return [text]
    return [text[i : i + n] for i in range(len(text) - n + 1)]


def compute_ngram_similarity_matrix(words: list[str]) -> dict[tuple[int, int], float]:
    """N-gramコサイン類似度行列を計算"""
    if len(words) < 2:
        return {}

    vectorizer = TfidfVectorizer(
        analyzer="char", ngram_range=(NGRAM_SIZE, NGRAM_SIZE)
    )

    try:
        tfidf_matrix = vectorizer.fit_transform(words)
        cos_sim = cosine_similarity(tfidf_matrix)
    except ValueError:
        return {}

    similarity_dict = {}
    for i in range(len(words)):
        for j in range(i + 1, len(words)):
            similarity_dict[(i, j)] = cos_sim[i, j]

    return similarity_dict


def build_similarity_graph(words: list[str]) -> nx.Graph:
    """類似度に基づいてグラフを構築"""
    graph = nx.Graph()
    graph.add_nodes_from(range(len(words)))

    # N-gram類似度を事前計算
    ngram_sim = compute_ngram_similarity_matrix(words)

    # 全ペアを比較
    for i in range(len(words)):
        for j in range(i + 1, len(words)):
            w1, w2 = words[i], words[j]

            # レーベンシュタイン類似度
            lev_sim = normalized_levenshtein(w1, w2)

            # ジャロ・ウィンクラー類似度
            jw_sim = jaro_winkler_similarity(w1, w2)

            # N-gramコサイン類似度
            ng_sim = ngram_sim.get((i, j), 0.0)

            # いずれかのしきい値を超えたらエッジを追加
            if (
                lev_sim >= LEVENSHTEIN_THRESHOLD
                or jw_sim >= JARO_WINKLER_THRESHOLD
                or ng_sim >= NGRAM_COSINE_THRESHOLD
            ):
                graph.add_edge(i, j)

    return graph


def extract_groups(
    graph: nx.Graph, words: list[str], frequency: Counter
) -> list[list[str]]:
    """連結成分を抽出してグループ化"""
    groups = []

    for component in nx.connected_components(graph):
        group_words = [words[i] for i in component]
        # 出現頻度順、同頻度なら元の順序を維持
        group_words.sort(key=lambda w: (-frequency[w], words.index(w)))
        groups.append(group_words)

    # グループを元のリストでの最初の出現順にソート
    groups.sort(key=lambda g: words.index(g[0]))

    return groups


def format_output(groups: list[list[str]]) -> str:
    """出力形式に整形"""
    lines = []
    for idx, group in enumerate(groups, start=1):
        lines.append(f"{idx}. {group[0]}")
        for word in group[1:]:
            lines.append(f"- {word}")
    return "\n".join(lines)


def save_output(output_path: str, content: str) -> None:
    """結果をファイルに保存"""
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(content)


def normalize_words(input_path: str, output_path: str) -> None:
    """メイン処理"""
    # 入力
    words = load_words(input_path)
    if not words:
        save_output(output_path, "")
        return

    # 第一次集計
    unique_words, frequency = get_unique_words_with_frequency(words)

    # グラフ構築
    graph = build_similarity_graph(unique_words)

    # グループ抽出
    groups = extract_groups(graph, unique_words, frequency)

    # 出力
    output_content = format_output(groups)
    save_output(output_path, output_content)


if __name__ == "__main__":
    import sys

    input_file = sys.argv[1] if len(sys.argv) > 1 else "input.txt"
    output_file = sys.argv[2] if len(sys.argv) > 2 else "output.txt"

    normalize_words(input_file, output_file)
    print(f"処理完了: {output_file}")
