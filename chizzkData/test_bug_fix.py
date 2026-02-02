"""
테스트용 버전 - 3개 클립만 수집
"""

from ShortForm import ChizzkClipCollector


def test_main():
    """테스트용 메인 함수 - 버그 수정 확인"""
    channel_id = "1d333ff175b4db5bd06f87a88579ec1e"

    print("[TEST] Bug fix test start")
    print(f"[INFO] Channel ID: {channel_id}")
    print(f"[INFO] Output: ./clips/")
    print(f"[INFO] Target clips: 3")
    print("=" * 50)

    # 클립 수집기 생성
    collector = ChizzkClipCollector(channel_id=channel_id, download_dir="clips")

    # 3개 클립만 테스트 수집
    collector.collect_clips(
        max_clips=3, filter_type="ALL", order_type="POPULAR"  # 테스트용으로 3개만
    )


if __name__ == "__main__":
    test_main()
