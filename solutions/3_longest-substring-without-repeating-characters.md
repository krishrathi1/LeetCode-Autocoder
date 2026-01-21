```python
class Solution:
    def lengthOfLongestSubstring(self, s: str) -> int:
        max_len = 0
        char_index = {}

        for i in range(len(s)):
            if s[i] in char_index and char_index[s[i]] >= i:
                max_len = max(max_len, i - char_index[s[i]])
            else:
                max_len = max(max_len, i - char_index.get(s[i], -1))
            char_index[s[i]] = i

        return max_len
```