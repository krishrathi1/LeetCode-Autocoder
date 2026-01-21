```python
class Solution:
    def longestPalindrome(self, s: str) -> str:
        def expand_around_center(left, right):
            while left >= 0 and right < len(s) and s[left] == s[right]:
                left -= 1
                right += 1
            return s[left + 1:right]
        
        if not s:
            return ""
        
        res = ""
        for i in range(len(s)):
            odd = expand_around_center(i, i)
            even = expand_around_center(i, i + 1)
            res = max([res, odd, even], key=len)
        
        return res
```