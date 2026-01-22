```java
import java.util.*;

class Solution {
    public int reverse(int x) {
        long res = 0;
        while (x != 0) {
            res = res * 10 + x % 10;
            if ((res > Integer.MAX_VALUE && x < 0) || (res > Integer.MIN_VALUE && x >= 0)) {
                return 0;
            }
            x /= 10;
        }
        return (int) res;
    }
}
```