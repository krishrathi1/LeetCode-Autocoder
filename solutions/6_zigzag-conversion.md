```java
import java.util.*;

class Solution {
    public String convert(String s, int numRows) {
        if (numRows == 1 || s.length() == 1) return s;
        
        char[][] grid = new char[numRows][s.length()];
        boolean isDescending = false;
        for (int i = 0; i < s.length(); i++) {
            int index = numRows - 1 - (i % (numRows - 1)) * isDescending;
            if (index >= 0 && index < numRows) grid[index][i] = s.charAt(i);
            
            if (isDescending) {
                if (i == numRows - 1) isDescending = false;
                else grid[numRows - 1 - (i % (numRows - 1))][i + 1] = s.charAt(i);
            } else {
                if (i == 0) isDescending = true;
                else grid[numRows - 1 - (i % (numRows - 1))][i - 1] = s.charAt(i);
            }
        }

        StringBuilder result = new StringBuilder();
        for (int i = 0; i < numRows; i++) {
            for (char c : grid[i]) {
                if (c != ' ') result.append(c);
            }
        }
        
        return result.toString();
    }
}
```