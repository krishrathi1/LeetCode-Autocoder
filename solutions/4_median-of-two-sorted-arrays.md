```java
import java.util.*;

class Solution {
    public double findMedianSortedArrays(int[] nums1, int[] nums2) {
        int m = nums1.length;
        int n = nums2.length;

        if (m > n) {
            return findMedianSortedArrays(nums2, nums1);
        }

        int left = 0;
        int right = m;

        while (left <= right) {
            int i = (left + right) / 2;
            int j = ((m + n + 1) / 2) - i; // binary search for the partition point

            int maxLeftX = (i == 0) ? Integer.MIN_VALUE : nums1[i-1];
            int minRightX = (i == m) ? Integer.MAX_VALUE : nums1[i];

            int maxLeftY = (j == 0) ? Integer.MIN_VALUE : nums2[j-1];
            int minRightY = (j == n) ? Integer.MAX_VALUE : nums2[j];

            if (maxLeftX <= minRightY && maxLeftY <= minRightX) {
                // partition is correct, now check which case we are in
                if ((m + n) % 2 == 0) {
                    return (Math.max(maxLeftX, maxLeftY) + Math.min(minRightX, minRightY)) / 2.0;
                } else {
                    return (double)Math.max(maxLeftX, maxLeftY);
                }
            } else if (maxLeftX > minRightY) {
                // partition is too far to the right
                right = i - 1;
            } else {
                left = i + 1;
            }
        }

        throw new RuntimeException("Unexpected error occurred");
    }
}
```