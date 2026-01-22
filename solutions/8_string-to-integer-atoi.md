```java
import java.util.*;

class Solution {
    public int myAtoi(String s) {
        // Remove leading whitespace and convert to string array
        String[] sArray = s.trim().split("\\s+");

        if (sArray.length == 0 || sArray[0].isEmpty()) return 0;

        // Extract the sign from the first character, defaulting to positive
        int sign = 1;
        if (sArray[0][0] == '-') {
            sign = -1;
            // Remove leading '-' from string array
            String[] newSArray = new String[sArray.length - 1];
            System.arraycopy(sArray, 1, newSArray, 0, sArray.length - 1);
            sArray = newSArray;
        } else if (sArray[0][0] == '+') {
            // Remove leading '+' from string array
            String[] newSArray = new String[sArray.length - 1];
            System.arraycopy(sArray, 1, newSArray, 0, sArray.length - 1);
            sArray = newSArray;
        }

        // Extract the numeric string and convert it to an integer
        int number = Integer.parseInt(new String(Arrays.stream(sArray).filter(e -> !e.isEmpty()).toArray(String[]::new)));

        // Apply sign to the number
        number *= sign;

        // Check if the number is within the range of 32-bit signed integers
        if (number < -Math.pow(2, 31)) {
            return -(int) Math.pow(2, 31);
        } else if (number > Math.pow(2, 31) - 1) {
            return (int) Math.pow(2, 31) - 1;
        }

        return number;
    }
}
```