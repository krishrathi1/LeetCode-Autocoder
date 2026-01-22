```java
import java.util.*;

class Solution {
    public String longestPalindrome(String s) {
        String res = "";
        for (int i = 0; i < s.length(); i++) {
            String palindrome1 = getLongestPalindromicSubString(s, i, i);
            String palindrome2 = getLongestPalindromicSubString(s, i, i + 1);
            if (palindrome1.length() > res.length()) {
                res = palindrome1;
            }
            if (palindrome2.length() > res.length()) {
                res = palindrome2;
            }
        }
        return res;
    }

    public String getLongestPalindromicSubString(String s, int left, int right) {
        while (left >= 0 && right < s.length() && s.charAt(left) == s.charAt(right)) {
            left--;
            right++;
        }
        return s.substring(left + 1, right);
    }

}
```